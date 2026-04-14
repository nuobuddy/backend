import https from 'node:https';
import http from 'node:http';
import { Transform } from 'node:stream';
import { URL } from 'node:url';
import { Response } from 'express';
import {
  DifyChatFile,
  DifyFileUploadResponse,
  DifyStreamEvent,
} from '@/types/dify';
import SettingService from './SettingService';

type DifyTransformStream = Transform & {
  difyConversationId: string;
  fullAnswer: string;
};

type DifyTransformState = {
  difyConversationId: string;
  fullAnswer: string;
  taskId: string;
  taskIdForwarded: boolean;
};

type DifyTransformResult = {
  stream: DifyTransformStream;
  state: DifyTransformState;
};

function createDifyTransform(): DifyTransformResult {
  let lineBuffer = '';
  const state: DifyTransformState = {
    difyConversationId: '',
    fullAnswer: '',
    taskId: '',
    taskIdForwarded: false,
  };

  function processBlock(block: string): string | null {
    const dataLine = block
      .split('\n')
      .find((line) => line.startsWith('data:'))
      ?.slice(5)
      .trim();

    if (!dataLine || dataLine === '[DONE]') return null;

    let parsed: DifyStreamEvent;
    try {
      parsed = JSON.parse(dataLine) as DifyStreamEvent;
    } catch {
      return null;
    }

    const parsedWithTask = parsed as DifyStreamEvent & { task_id?: unknown };
    if (typeof parsedWithTask.task_id === 'string' && parsedWithTask.task_id.trim()) {
      state.taskId = parsedWithTask.task_id.trim();
    }

    const outgoingEvents: string[] = [];

    if (state.taskId && !state.taskIdForwarded) {
      state.taskIdForwarded = true;
      outgoingEvents.push(`event: task\ndata: ${JSON.stringify({ taskId: state.taskId })}\n\n`);
    }

    if (parsed.event === 'message') {
      const content = parsed.answer ?? '';
      if (parsed.conversation_id) state.difyConversationId = parsed.conversation_id;
      state.fullAnswer += content;

      const payload: { content: string; taskId?: string } = { content };
      if (state.taskId) {
        payload.taskId = state.taskId;
      }

      outgoingEvents.push(`event: delta\ndata: ${JSON.stringify(payload)}\n\n`);
      return outgoingEvents.join('');
    }

    if (parsed.event === 'message_end') {
      if (parsed.conversation_id) state.difyConversationId = parsed.conversation_id;
      return outgoingEvents.length > 0 ? outgoingEvents.join('') : null;
    }

    if (parsed.event === 'error') {
      outgoingEvents.push(`event: error\ndata: ${JSON.stringify({ message: parsed.message ?? 'Unknown Dify error' })}\n\n`);
      return outgoingEvents.join('');
    }

    return outgoingEvents.length > 0 ? outgoingEvents.join('') : null;
  }

  const transform = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      lineBuffer += chunk.toString('utf8');

      const blocks = lineBuffer.split('\n\n');
      lineBuffer = blocks.pop() ?? '';

      blocks.forEach((block) => {
        const out = processBlock(block);
        if (out) transform.push(out);
      });

      callback();
    },
    flush(callback) {
      if (lineBuffer.trim()) {
        const out = processBlock(lineBuffer);
        if (out) transform.push(out);
      }
      callback();
    },
  }) as DifyTransformStream;

  return { stream: transform, state };
}

export class DifyService {
  private static buildMultipartPayload(params: {
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    };
    userId: string;
  }): { body: Buffer; contentType: string } {
    const boundary = `----NuobuddyBoundary${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const safeFilename = params.file.originalname.replace(/"/g, '%22');
    const mimeType = params.file.mimetype || 'application/octet-stream';

    const filePartHeader = Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="file"; filename="${safeFilename}"\r\n`
      + `Content-Type: ${mimeType}\r\n\r\n`,
      'utf8',
    );

    const userPart = Buffer.from(
      `\r\n--${boundary}\r\n`
      + 'Content-Disposition: form-data; name="user"\r\n\r\n'
      + `${params.userId}\r\n`
      + `--${boundary}--\r\n`,
      'utf8',
    );

    return {
      body: Buffer.concat([filePartHeader, params.file.buffer, userPart]),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  private static async postMultipartAndGetRawBody(params: {
    baseUrl: string;
    apiKey: string;
    path: string;
    body: Buffer;
    contentType: string;
  }): Promise<string> {
    const response = await fetch(`${params.baseUrl}${params.path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': params.contentType,
        'Content-Length': String(params.body.length),
      },
      body: params.body,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(this.parseDifyError(rawBody, response.status));
    }

    return rawBody;
  }

  private static async getDifyConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const rawBaseUrl = await SettingService.get('dify.base_url', 'https://api.dify.ai');
    const baseUrl = (rawBaseUrl ?? '').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const apiKey = await SettingService.get('dify.api_key');

    if (!apiKey) {
      throw new Error('Dify API key not configured');
    }

    return { baseUrl, apiKey };
  }

  private static parseDifyError(rawBody: string, statusCode: number): string {
    if (!rawBody) {
      return `Dify API error: ${statusCode}`;
    }

    try {
      const parsed = JSON.parse(rawBody) as {
        message?: string;
        code?: string;
      };

      if (parsed.message && parsed.code) {
        return `${parsed.message} (${parsed.code})`;
      }
      if (parsed.message) {
        return parsed.message;
      }
      if (parsed.code) {
        return `Dify API error: ${parsed.code}`;
      }
    } catch {
      // Keep fallback message below.
    }

    return `Dify API error: ${statusCode}`;
  }

  static async audioToText(params: {
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    };
    userId: string;
  }): Promise<{ text: string }> {
    const { baseUrl, apiKey } = await this.getDifyConfig();
    const multipartPayload = this.buildMultipartPayload(params);
    const rawBody = await this.postMultipartAndGetRawBody({
      baseUrl,
      apiKey,
      path: '/v1/audio-to-text',
      body: multipartPayload.body,
      contentType: multipartPayload.contentType,
    });

    let parsed: { text?: string };
    try {
      parsed = JSON.parse(rawBody) as { text?: string };
    } catch {
      throw new Error('Invalid Dify audio-to-text response');
    }

    if (typeof parsed.text !== 'string') {
      throw new Error('Dify audio-to-text response missing text field');
    }

    return { text: parsed.text };
  }

  static async uploadFile(params: {
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    };
    userId: string;
  }): Promise<DifyFileUploadResponse> {
    const { baseUrl, apiKey } = await this.getDifyConfig();
    const multipartPayload = this.buildMultipartPayload(params);
    const rawBody = await this.postMultipartAndGetRawBody({
      baseUrl,
      apiKey,
      path: '/v1/files/upload',
      body: multipartPayload.body,
      contentType: multipartPayload.contentType,
    });

    let parsed: DifyFileUploadResponse;
    try {
      parsed = JSON.parse(rawBody) as DifyFileUploadResponse;
    } catch {
      throw new Error('Invalid Dify upload response');
    }

    if (!parsed.id || !parsed.name) {
      throw new Error('Dify upload response missing required fields');
    }

    return parsed;
  }

  static async previewFile(params: {
    fileId: string;
    userId: string;
  }): Promise<{ data: Buffer; contentType: string }> {
    const { baseUrl, apiKey } = await this.getDifyConfig();

    const url = new URL(`${baseUrl}/v1/files/${params.fileId}/preview`);
    url.searchParams.set('user', params.userId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const rawBody = await response.text();
      throw new Error(this.parseDifyError(rawBody, response.status));
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return {
      data: Buffer.from(arrayBuffer),
      contentType,
    };
  }

  static async stopChatMessageGeneration(params: {
    taskId: string;
    userId: string;
  }): Promise<{ result: string }> {
    const { baseUrl, apiKey } = await this.getDifyConfig();
    const safeTaskId = encodeURIComponent(params.taskId);

    const response = await fetch(`${baseUrl}/v1/chat-messages/${safeTaskId}/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user: params.userId }),
    });

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(this.parseDifyError(rawBody, response.status));
    }

    let parsed: { result?: string };
    try {
      parsed = JSON.parse(rawBody) as { result?: string };
    } catch {
      throw new Error('Invalid Dify stop response');
    }

    if (typeof parsed.result !== 'string' || !parsed.result) {
      throw new Error('Dify stop response missing result');
    }

    return { result: parsed.result };
  }

  /**
   * Stream a chat request to Dify and pipe transformed SSE events directly to
   * the Express client response — true streaming with minimal transformation.
   *
   * Pipeline:
   *   Dify IncomingMessage
   *     └─ DifyTransform   (rewrites event names; accumulates answer as side-effect)
   *         └─ clientRes   (pipe with end:false so caller can append `done` event)
   */
  static async streamChat(params: {
    query: string;
    difyConversationId: string;
    userId: string;
    files?: DifyChatFile[];
    clientRes: Response;
  }): Promise<{ difyConversationId: string; fullAnswer: string }> {
    const { baseUrl, apiKey } = await this.getDifyConfig();

    const url = new URL(`${baseUrl}/v1/chat-messages`);
    const requestBody: {
      inputs: Record<string, unknown>;
      query: string;
      response_mode: 'streaming';
      conversation_id: string;
      user: string;
      files?: DifyChatFile[];
    } = {
      inputs: {},
      query: params.query,
      response_mode: 'streaming',
      conversation_id: params.difyConversationId,
      user: params.userId,
    };

    if (params.files && params.files.length > 0) {
      requestBody.files = params.files;
    }

    const body = JSON.stringify(requestBody);

    return new Promise<{ difyConversationId: string; fullAnswer: string }>((resolve, reject) => {
      const transport = url.protocol === 'https:' ? https : http;

      const req = transport.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            // Tell any intermediate Nginx proxy to disable buffering
            // (respected by openresty/nginx via proxy_pass + X-Accel-Buffering)
            'X-Accel-Buffering': 'no',
            'Cache-Control': 'no-cache',
          },
        },
        (difyRes) => {
          // Disable Nagle on the underlying socket so TLS records are not
          // held waiting for more data — each small SSE chunk is sent immediately
          difyRes.socket?.setNoDelay(true);
          if (difyRes.statusCode && difyRes.statusCode >= 400) {
            const chunks: Buffer[] = [];
            difyRes.on('data', (chunk: Buffer | string) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            difyRes.on('end', () => {
              const rawBody = Buffer.concat(chunks).toString('utf8');
              reject(new Error(this.parseDifyError(rawBody, difyRes.statusCode || 500)));
            });
            return;
          }

          const { stream: transformer, state } = createDifyTransform();

          transformer.on('error', reject);

          // When the transform stream finishes, all Dify data has been
          // processed and forwarded to clientRes.
          transformer.on('finish', () => {
            resolve({
              difyConversationId: state.difyConversationId,
              fullAnswer: state.fullAnswer,
            });
          });

          // Dify ──> DifyTransform ──> clientRes (keep open for `done` event)
          difyRes.pipe(transformer).pipe(params.clientRes, { end: false });
        },
      );

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}
