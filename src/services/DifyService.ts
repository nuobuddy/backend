// src/services/DifyService.ts
import { Response } from 'express';
import { DifyStreamEvent } from '@/types/dify';
// TODO: 恢复从 SettingService 动态读取 Dify 配置
// import { SettingService } from './SettingService';

// TODO: 临时硬编码，SettingService 完成后替换为动态读取
const DIFY_BASE_URL = 'https://api.dify.ai';
const DIFY_API_KEY = 'app-xxxxxxxxxxxxxxxx';

export class DifyService {
  /**
   * 向 Dify 发送流式对话请求，并将 SSE 事件透传至客户端 Response。
   * 在流结束后，返回 Dify 分配的 conversation_id（首次对话时为新 ID）。
   */
  static async streamChat(params: {
    query: string;
    difyConversationId: string; // 空字符串代表新对话
    userId: string;
    clientRes: Response; // Express Response，用于写入 SSE
  }): Promise<{ difyConversationId: string }> {
    // TODO: 恢复从 SettingService 动态读取
    // const baseUrl = await SettingService.get('dify.base_url', 'https://api.dify.ai');
    // const apiKey = await SettingService.get('dify.api_key');
    // if (!apiKey) throw new Error('Dify API key not configured');
    const baseUrl = DIFY_BASE_URL;
    const apiKey = DIFY_API_KEY;

    const difyRes = await fetch(`${baseUrl}/v1/chat-messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: params.query,
        response_mode: 'streaming',
        conversation_id: params.difyConversationId,
        user: params.userId,
      }),
    });

    if (!difyRes.ok) {
      throw new Error(`Dify API error: ${difyRes.status}`);
    }

    return DifyService.pipeStream(difyRes, params.clientRes);
  }

  /**
   * 将 Dify 的 SSE 流解析并透传至客户端，处理各事件类型。
   * 返回本次对话的 difyConversationId。
   */
  private static async pipeStream(
    difyRes: Awaited<ReturnType<typeof fetch>>,
    clientRes: Response,
  ): Promise<{ difyConversationId: string }> {
    const body = difyRes.body as ReadableStream<Uint8Array> | null;
    if (!body) {
      throw new Error('Dify response has no body');
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let difyConversationId = '';

    const writeEvent = (event: string, data: unknown) => {
      clientRes.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const handleEvent = (parsed: DifyStreamEvent) => {
      if (parsed.event === 'message') {
        if (parsed.conversation_id) {
          difyConversationId = parsed.conversation_id;
        }
        writeEvent('delta', { content: parsed.answer });
      } else if (parsed.event === 'message_end') {
        if (parsed.conversation_id) {
          difyConversationId = parsed.conversation_id;
        }
        // done 事件在调用方写入（携带本地 conversationId），此处不写
      } else if (parsed.event === 'error') {
        writeEvent('error', { message: parsed.message });
      }
      // ping 事件：心跳，忽略
    };

    const processChunk = (chunk: string) => {
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6)
        .trim();

      if (!dataLine || dataLine === '[DONE]') return;

      try {
        const parsed = JSON.parse(dataLine) as DifyStreamEvent;
        handleEvent(parsed);
      } catch {
        // 忽略无法解析的行
      }
    };

    const readAll = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      parts.forEach(processChunk);

      await readAll();
    };

    try {
      await readAll();
    } finally {
      reader.releaseLock();
    }

    return { difyConversationId };
  }
}
