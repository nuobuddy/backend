import type { Response as ExpressResponse } from 'express';
import { DifyService } from '@/services/DifyService';

global.fetch = jest.fn();

const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

const createSseBody = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
        return;
      }

      controller.close();
    },
  });
};

describe('DifyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('streamChat', () => {
    it('pipes SSE events to client and returns latest conversation ID', async () => {
      const clientRes = {
        write: jest.fn(),
      } as unknown as ExpressResponse;

      const sseBody = createSseBody([
        'data: {"event":"message","answer":"Hello","conversation_id":"conv-1","message_id":"m-1"}\n\n',
        'data: {"event":"ping"}\n\n',
        'data: {"event":"error","code":"bad_request","message":"Something failed","status":400}\n\n',
        'data: {"event":"message_end","conversation_id":"conv-2","metadata":{}}\n\n',
        'data: [DONE]\n\n',
      ]);

      mockedFetch.mockResolvedValue({
        ok: true,
        body: sseBody,
      } as unknown as FetchResponse);

      const result = await DifyService.streamChat({
        query: 'How are you?',
        difyConversationId: '',
        userId: 'user-1',
        clientRes,
      });

      expect(mockedFetch).toHaveBeenCalledWith('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer app-xxxxxxxxxxxxxxxx',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {},
          query: 'How are you?',
          response_mode: 'streaming',
          conversation_id: '',
          user: 'user-1',
        }),
      });

      expect(clientRes.write).toHaveBeenCalledTimes(2);
      expect(clientRes.write).toHaveBeenNthCalledWith(1, 'event: delta\ndata: {"content":"Hello"}\n\n');
      expect(clientRes.write).toHaveBeenNthCalledWith(
        2,
        'event: error\ndata: {"message":"Something failed"}\n\n',
      );
      expect(result).toEqual({ difyConversationId: 'conv-2' });
    });

    it('throws when Dify returns non-OK response', async () => {
      mockedFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as FetchResponse);

      await expect(
        DifyService.streamChat({
          query: 'How are you?',
          difyConversationId: '',
          userId: 'user-1',
          clientRes: { write: jest.fn() } as unknown as ExpressResponse,
        }),
      ).rejects.toThrow('Dify API error: 401');
    });
  });

  describe('pipeStream', () => {
    it('throws when Dify response body is missing', async () => {
      const serviceWithPrivate = DifyService as unknown as {
        pipeStream: (
          difyRes: FetchResponse,
          clientRes: ExpressResponse,
        ) => Promise<{ difyConversationId: string }>;
      };

      await expect(
        serviceWithPrivate.pipeStream(
          { body: null } as FetchResponse,
          { write: jest.fn() } as unknown as ExpressResponse,
        ),
      ).rejects.toThrow('Dify response has no body');
    });
  });
});
