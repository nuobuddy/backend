import https from 'node:https';
import http from 'node:http';
import { Transform } from 'node:stream';
import { URL } from 'node:url';
import { Response } from 'express';
import { DifyStreamEvent } from '@/types/dify';
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
    clientRes: Response;
  }): Promise<{ difyConversationId: string; fullAnswer: string }> {
    const rawBaseUrl = await SettingService.get('dify.base_url', 'https://api.dify.ai');
    const baseUrl = (rawBaseUrl ?? '').replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const apiKey = await SettingService.get('dify.api_key');
    if (!apiKey) throw new Error('Dify API key not configured');

    const url = new URL(`${baseUrl}/v1/chat-messages`);
    const body = JSON.stringify({
      inputs: {},
      query: params.query,
      response_mode: 'streaming',
      conversation_id: params.difyConversationId,
      user: params.userId,
    });

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
            difyRes.resume();
            reject(new Error(`Dify API error: ${difyRes.statusCode}`));
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
