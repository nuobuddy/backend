import {
  IRouter, Router, Request, Response,
} from 'express';
import {
  sendError, sendNotFound, sendSuccess, sendUnauthorized,
} from '@/lib/response';
import { asyncHandler } from '@/middleware/asyncHandler';
import { auth } from '@/middleware/auth';
import { ConversationService } from '@/services/ConversationService';
import { DifyService } from '@/services/DifyService';

const router: IRouter = Router();

interface CreateConversationBody {
  title?: string;
}

interface SendMessageBody {
  query?: string;
  inputs?: Record<string, unknown>;
}

function getUserId(req: Request, res: Response): string | null {
  const userId = req.user?.userId;

  if (!userId) {
    sendUnauthorized(res, 'Authentication required.');
    return null;
  }

  return userId;
}

function setSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

async function syncDifyConversationId(
  lines: string[],
  localConversationId: string,
  userId: string,
  currentDifyConversationId: string | null,
): Promise<string | null> {
  if (currentDifyConversationId) {
    return currentDifyConversationId;
  }

  const event = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')
    .map((line) => {
      try {
        return JSON.parse(line) as { conversation_id?: string };
      } catch {
        return null;
      }
    })
    .find((payload): payload is { conversation_id: string } => Boolean(payload?.conversation_id));

  if (!event?.conversation_id) {
    return null;
  }

  await ConversationService.updateDifyId(localConversationId, userId, event.conversation_id);
  return event.conversation_id;
}

router.use(auth);

router.get('/conversations', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req, res);

  if (!userId) {
    return;
  }

  const conversations = await ConversationService.listByUser(userId);
  sendSuccess(res, conversations);
}));

router.post('/conversations', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req, res);

  if (!userId) {
    return;
  }

  const { title } = req.body as CreateConversationBody;
  const conversation = await ConversationService.create(userId, title);
  sendSuccess(res, conversation, 'Conversation created.', 201);
}));

router.post('/deleteConversations/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req, res);

  if (!userId) {
    return;
  }

  const deleted = await ConversationService.deleteByIdAndUser(req.params.id, userId);

  if (!deleted) {
    sendNotFound(res, 'Conversation not found.');
    return;
  }

  sendSuccess(res, null, 'Conversation deleted.');
}));

router.post('/conversations/:id/message', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req, res);

  if (!userId) {
    return;
  }

  const { query, inputs } = req.body as SendMessageBody;

  if (!query?.trim()) {
    sendError(res, 'Query is required.', 400);
    return;
  }

  const conversation = await ConversationService.findByIdAndUser(req.params.id, userId);

  if (!conversation) {
    sendNotFound(res, 'Conversation not found.');
    return;
  }

  await ConversationService.touch(conversation.id, userId);

  const difyResponse = await DifyService.sendMessageStream({
    query: query.trim(),
    user: userId,
    conversationId: conversation.difyConversationId,
    inputs,
  });

  setSseHeaders(res);

  const reader = difyResponse.body!.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let { difyConversationId } = conversation;

  req.on('close', () => {
    reader.cancel().catch(() => undefined);
  });

  try {
    const forwardStream = async (): Promise<void> => {
      const readResult = await reader.read();
      const { done, value } = readResult;

      if (done || !value) {
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
      sseBuffer += chunk;

      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      difyConversationId = await syncDifyConversationId(
        lines,
        conversation.id,
        userId,
        difyConversationId,
      );

      await forwardStream();
    };

    await forwardStream();

    if (sseBuffer) {
      difyConversationId = await syncDifyConversationId(
        [sseBuffer],
        conversation.id,
        userId,
        difyConversationId,
      );
    }
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({
      message: error instanceof Error ? error.message : 'Streaming interrupted.',
    })}\n\n`);
  } finally {
    res.end();
  }
}));

export default router;
