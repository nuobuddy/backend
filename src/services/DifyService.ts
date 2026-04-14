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

    if (parsed.event === 'message') {
      const content = parsed.answer ?? '';
      if (parsed.conversation_id) state.difyConversationId = parsed.conversation_id;
      state.fullAnswer += content;
      return `event: delta\ndata: ${JSON.stringify({ content })}\n\n`;
    }

    if (parsed.event === 'message_end') {
      if (parsed.conversation_id) state.difyConversationId = parsed.conversation_id;
      return null;
    }

    if (parsed.event === 'error') {
      return `event: error\ndata: ${JSON.stringify({ message: parsed.message ?? 'Unknown Dify error' })}\n\n`;
    }

    return null;
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

  static async uploadFile(params: {
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
    };
    userId: string;
  }): Promise<DifyFileUploadResponse> {
    const { baseUrl, apiKey } = await this.getDifyConfig();

    const formData = new FormData();
    const fileBlob = new Blob([params.file.buffer], {
      type: params.file.mimetype || 'application/octet-stream',
    });

    formData.append('file', fileBlob, params.file.originalname);
    formData.append('user', params.userId);

    const response = await fetch(`${baseUrl}/v1/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(this.parseDifyError(rawBody, response.status));
    }

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
