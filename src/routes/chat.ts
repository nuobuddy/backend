import { IRouter, Router, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
} from '@/lib/response';
import { ConversationService } from '@/services/ConversationService';
import { DifyService } from '@/services/DifyService';

const router: IRouter = Router();

// ====================================================================
// GET /chat — Chat API info
// ====================================================================
router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    sendSuccess(
      res,
      {
        endpoints: [
          'GET  /chat/conversations',
          'POST /chat/conversations',
          'POST /chat/deleteConversations',
          'POST /chat/conversations/:id/message',
          'GET  /chat/conversations/:id/share',
          'POST /chat/conversations/:id/share',
          'DELETE /chat/conversations/:id/share',
        ],
      },
      'Chat API',
    );
  }),
);

// ====================================================================
// GET /chat/conversations — List user's conversations (paginated)
// ====================================================================
router.get(
  '/conversations',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string, 10) || 10),
    );

    const { conversations, total } = await ConversationService.findByUser(
      userId,
      page,
      limit,
    );

    sendSuccess(res, {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ====================================================================
// POST /chat/conversations — Create a new conversation
// ====================================================================
router.post(
  '/conversations',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { title } = req.body as { title?: string };

    const conversation = await ConversationService.create(userId, title);

    sendSuccess(
      res,
      {
        id: conversation.id,
        title: conversation.title,
        difyConversationId: conversation.difyConversationId,
        createdAt: conversation.createdAt,
      },
      'Conversation created',
    );
  }),
);

// ====================================================================
// POST /chat/deleteConversations — Delete a conversation
// ====================================================================
router.post(
  '/deleteConversations',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { id } = req.body as { id?: string };

    if (!id) {
      sendBadRequest(res, 'Conversation ID is required');
      return;
    }

    const conversation = await ConversationService.findById(id);
    if (!conversation) {
      sendNotFound(res, 'Conversation not found');
      return;
    }
    if (conversation.userId !== userId) {
      sendForbidden(res, 'You do not own this conversation');
      return;
    }

    await ConversationService.delete(id);
    sendSuccess(res, null, 'Conversation deleted');
  }),
);

// ====================================================================
// POST /chat/conversations/:id/message — Send message (SSE streaming)
// ====================================================================
router.post(
  '/conversations/:id/message',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const conversationId = req.params.id;
    const { query } = req.body as { query?: string };

    if (!query || !query.trim()) {
      sendBadRequest(res, 'Query is required');
      return;
    }

    // Find the conversation (or allow empty ID for auto-creation)
    const conversation = await ConversationService.findById(conversationId);
    if (!conversation) {
      sendNotFound(res, 'Conversation not found');
      return;
    }
    if (conversation.userId !== userId) {
      sendForbidden(res, 'You do not own this conversation');
      return;
    }

    // Save user message to DB
    await ConversationService.addMessage(conversationId, 'user', query.trim());

    // Auto-set title from first message if empty
    if (!conversation.title) {
      await ConversationService.updateTitle(
        conversationId,
        query.trim().slice(0, 60),
      );
    }

    // Force streaming headers — writeHead sends them immediately (no buffering)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    });

    try {
      const { difyConversationId, fullAnswer } = await DifyService.streamChat({
        query: query.trim(),
        difyConversationId: conversation.difyConversationId || '',
        userId,
        clientRes: res,
      });

      // Save assistant response to DB
      if (fullAnswer) {
        await ConversationService.addMessage(
          conversationId,
          'assistant',
          fullAnswer,
        );
      }

      // Update difyConversationId if this was the first message
      if (difyConversationId && !conversation.difyConversationId) {
        await ConversationService.updateDifyConversationId(
          conversationId,
          difyConversationId,
        );
      }

      // Send the done event with local conversationId
      res.write(`event: done\ndata: ${JSON.stringify({ conversationId })}\n\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming failed';
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      res.end();
    }
  }),
);

// ====================================================================
// GET /chat/conversations/:id/share — Get conversation detail
// Public when ?share=1 and conversation.share === true
// Otherwise requires auth + ownership
// ====================================================================
router.get(
  '/conversations/:id/share',
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const conversationId = req.params.id;
    const isShareAccess = req.query.share === '1';

    const conversation = await ConversationService.findByIdWithMessages(conversationId);
    if (!conversation) {
      sendNotFound(res, 'Conversation not found');
      return;
    }

    // Shared access — no auth required but conversation.share must be true
    if (isShareAccess) {
      if (!conversation.share) {
        sendForbidden(
          res,
          "This conversation is not shared or you don't have access",
        );
        return;
      }

      sendSuccess(res, {
        id: conversation.id,
        title: conversation.title,
        difyConversationId: conversation.difyConversationId,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: (conversation.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        share: conversation.share,
        accessible: true,
      });
      return;
    }

    // Authenticated access — run auth middleware manually
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // After auth, check if the response was already sent (401)
    if (res.headersSent) return;

    if (!req.user) {
      // authMiddleware already sent 401
      return;
    }

    if (conversation.userId !== req.user.userId) {
      sendForbidden(res, 'You do not own this conversation');
      return;
    }

    sendSuccess(res, {
      id: conversation.id,
      title: conversation.title,
      difyConversationId: conversation.difyConversationId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: (conversation.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      share: conversation.share,
      accessible: true,
    });
  }),
);

// ====================================================================
// POST /chat/conversations/:id/share — Enable share link
// ====================================================================
router.post(
  '/conversations/:id/share',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const conversationId = req.params.id;

    const conversation = await ConversationService.findById(conversationId);
    if (!conversation) {
      sendNotFound(res, 'Conversation not found');
      return;
    }
    if (conversation.userId !== userId) {
      sendForbidden(res, 'You do not own this conversation');
      return;
    }

    await ConversationService.enableShare(conversationId);

    const shareUrl = `${req.protocol}://${req.get('host')}/chat/${conversationId}?share=1`;
    sendSuccess(res, { shareUrl }, 'Share link created successfully');
  }),
);

// ====================================================================
// DELETE /chat/conversations/:id/share — Cancel share link
// ====================================================================
router.delete(
  '/conversations/:id/share',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const conversationId = req.params.id;

    const conversation = await ConversationService.findById(conversationId);
    if (!conversation) {
      sendNotFound(res, 'Conversation not found');
      return;
    }
    if (conversation.userId !== userId) {
      sendForbidden(res, 'You do not own this conversation');
      return;
    }

    await ConversationService.disableShare(conversationId);
    sendSuccess(res, null, 'Share link cancelled successfully');
  }),
);

export default router;
