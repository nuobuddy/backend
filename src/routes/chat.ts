import {
  IRouter, Router, Request, Response,
} from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import {
  sendBadRequest,
  sendNotFound,
  sendSuccess,
} from '@/lib/response';
import ConversationService from '@/services/ConversationService';
import { DifyService } from '@/services/DifyService';

const router: IRouter = Router();

interface CreateConversationBody {
  title?: string;
}

interface SendMessageBody {
  query?: string;
}

interface ConversationDto {
  id: string;
  title: string | null;
  difyConversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function parsePositiveInteger(value: unknown, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }

  // Query params arrive as strings, so normalize them before validation.
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return Number.NaN;
  }

  return parsed;
}

function toConversationDto(conversation: ConversationDto): ConversationDto {
  return {
    id: conversation.id,
    title: conversation.title,
    difyConversationId: conversation.difyConversationId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

async function deleteConversation(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { userId } = req.user!;
  const deleted = await ConversationService.deleteByIdAndUser(id, userId);

  if (!deleted) {
    sendNotFound(res, 'Conversation not found');
    return;
  }

  sendSuccess(res, null, 'Conversation deleted successfully');
}

/**
 * GET /chat
 * Placeholder - list available chat endpoints.
 */
router.get('/', asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, 'Chat API');
}));

router.get('/conversations', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, 10);

  if (Number.isNaN(page) || Number.isNaN(limit) || limit > 100) {
    sendBadRequest(res, 'Invalid pagination parameters');
    return;
  }

  const { userId } = req.user!;
  const result = await ConversationService.listByUser({ userId, page, limit });

  sendSuccess(res, {
    conversations: result.conversations.map(toConversationDto),
    pagination: result.pagination,
  }, 'Success');
}));

router.post('/conversations', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { title } = req.body as CreateConversationBody;

  if (title !== undefined && typeof title !== 'string') {
    sendBadRequest(res, 'Title must be a string');
    return;
  }

  const { userId } = req.user!;
  const conversation = await ConversationService.create({ userId, title });

  sendSuccess(res, toConversationDto(conversation), 'Success');
}));

// Keep supporting the legacy delete endpoint while also exposing a RESTful one.
router.delete('/conversations/:id', authMiddleware, asyncHandler(deleteConversation));

router.post('/deleteConversations/:id', authMiddleware, asyncHandler(deleteConversation));

router.post('/conversations/:id/message', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { query } = req.body as SendMessageBody;

  if (!query?.trim()) {
    sendBadRequest(res, 'Query is required');
    return;
  }

  const { userId } = req.user!;
  const conversation = await ConversationService.findByIdAndUser(id, userId);

  if (!conversation) {
    sendNotFound(res, 'Conversation not found');
    return;
  }

  // The route owns SSE framing so DifyService can focus on upstream streaming.
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const { difyConversationId } = await DifyService.streamChat({
      query: query.trim(),
      difyConversationId: conversation.difyConversationId ?? '',
      userId,
      clientRes: res,
    });

    if (difyConversationId && difyConversationId !== conversation.difyConversationId) {
      await ConversationService.updateDifyId(conversation.id, userId, difyConversationId);
    }

    // Return the local conversation id so the client can reconcile streamed output.
    res.write(`event: done\ndata: ${JSON.stringify({ conversationId: conversation.id })}\n\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stream chat';
    res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
  } finally {
    res.end();
  }
}));

export default router;
