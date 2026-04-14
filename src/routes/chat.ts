import { IRouter, Router, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '@/middleware/asyncHandler';
import { authMiddleware, AuthRequest } from '@/middleware/auth';
import {
  sendSuccess,
  sendBadRequest,
  sendError,
  sendNotFound,
  sendForbidden,
} from '@/lib/response';
import { MessageAttachment } from '@/entities/Message';
import { ConversationService } from '@/services/ConversationService';
import { DifyService } from '@/services/DifyService';
import { DifyChatFile, DifyFileType } from '@/types/dify';

const router: IRouter = Router();

const MAX_UPLOAD_FILE_SIZE_BYTES = 30 * 1024 * 1024;
const SINGLE_FILE_UPLOAD_LIMITS = {
  files: 1,
  fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
};

function createSingleFileUpload(): multer.Multer {
  return multer({
    storage: multer.memoryStorage(),
    limits: SINGLE_FILE_UPLOAD_LIMITS,
  });
}

async function runSingleFileUpload(params: {
  req: AuthRequest;
  res: Response;
  uploader: multer.Multer;
  fieldName: string;
  sizeExceededMessage: string;
  invalidRequestMessage: string;
  missingFileMessage: string;
}): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      params.uploader.single(params.fieldName)(params.req, params.res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        sendError(params.res, params.sizeExceededMessage, 413);
        return false;
      }

      sendBadRequest(params.res, err.message || params.invalidRequestMessage);
      return false;
    }

    throw err;
  }

  if (!params.req.file) {
    sendBadRequest(params.res, params.missingFileMessage);
    return false;
  }

  return true;
}

const upload = createSingleFileUpload();

const VALID_FILE_TYPES: DifyFileType[] = [
  'image',
  'document',
  'audio',
  'video',
  'custom',
];

function inferDifyFileType(mimeType: string | null): DifyFileType {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

function parseMessageFiles(files: unknown): DifyChatFile[] | null {
  if (files === undefined) return [];
  if (!Array.isArray(files)) return null;

  if (files.length > 1) {
    return null;
  }

  const parsedFiles = files.map((file) => {
    if (!file || typeof file !== 'object') return null;

    const rawType = (file as { type?: unknown }).type;
    const rawTransferMethod = (file as { transfer_method?: unknown }).transfer_method;
    const rawUploadFileId = (file as { upload_file_id?: unknown }).upload_file_id;

    if (
      typeof rawType !== 'string'
      || !VALID_FILE_TYPES.includes(rawType as DifyFileType)
    ) {
      return null;
    }

    if (rawTransferMethod !== 'local_file') {
      return null;
    }

    if (typeof rawUploadFileId !== 'string' || !rawUploadFileId.trim()) {
      return null;
    }

    const normalizedFile: DifyChatFile = {
      type: rawType as DifyFileType,
      transfer_method: 'local_file',
      upload_file_id: rawUploadFileId.trim(),
    };

    return normalizedFile;
  });

  if (parsedFiles.some((file) => file === null)) {
    return null;
  }

  return parsedFiles as DifyChatFile[];
}

function parseMessageAttachments(attachments: unknown): MessageAttachment[] | null {
  if (attachments === undefined) return [];
  if (!Array.isArray(attachments)) return null;
  if (attachments.length > 1) return null;

  const parsedAttachments = attachments.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return null;

    const rawId = (attachment as { id?: unknown }).id;
    const rawName = (attachment as { name?: unknown }).name;
    const rawSize = (attachment as { size?: unknown }).size;
    const rawMimeType = (attachment as { mimeType?: unknown }).mimeType;
    const rawFileType = (attachment as { fileType?: unknown }).fileType;

    if (typeof rawId !== 'string' || !rawId.trim()) return null;
    if (typeof rawName !== 'string' || !rawName.trim()) return null;
    if (typeof rawSize !== 'number' || Number.isNaN(rawSize) || rawSize < 0) return null;
    if (
      rawMimeType !== null
      && rawMimeType !== undefined
      && typeof rawMimeType !== 'string'
    ) {
      return null;
    }
    if (
      typeof rawFileType !== 'string'
      || !VALID_FILE_TYPES.includes(rawFileType as DifyFileType)
    ) {
      return null;
    }

    const normalizedAttachment: MessageAttachment = {
      id: rawId.trim(),
      name: rawName.trim(),
      size: rawSize,
      mimeType: typeof rawMimeType === 'string' ? rawMimeType : null,
      fileType: rawFileType as MessageAttachment['fileType'],
    };

    return normalizedAttachment;
  });

  if (parsedAttachments.some((attachment) => attachment === null)) {
    return null;
  }

  return parsedAttachments as MessageAttachment[];
}

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
          'POST /chat/files/upload',
          'GET  /chat/files/:fileId/preview',
          'POST /chat/audio-to-text',
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
// GET /chat/files/:fileId/preview — Preview a previously uploaded file
// ====================================================================
router.get(
  '/files/:fileId/preview',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;
    const { fileId } = req.params;

    if (!fileId || !fileId.trim()) {
      sendBadRequest(res, 'File ID is required');
      return;
    }

    try {
      const file = await DifyService.previewFile({
        fileId: fileId.trim(),
        userId,
      });

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.status(200).send(file.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';

      if (/not found|file_not_found/i.test(message)) {
        sendNotFound(res, message);
        return;
      }

      if (/access denied|file_access_denied|forbidden/i.test(message)) {
        sendError(res, message, 403);
        return;
      }

      sendBadRequest(res, message);
    }
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
// POST /chat/files/upload — Upload one file for Dify chat message usage
// ====================================================================
router.post(
  '/files/upload',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;

    const uploaded = await runSingleFileUpload({
      req,
      res,
      uploader: upload,
      fieldName: 'file',
      sizeExceededMessage: 'File size exceeded.',
      invalidRequestMessage: 'Invalid upload request',
      missingFileMessage: 'Please upload your file.',
    });

    if (!uploaded) {
      return;
    }

    const uploadedFileRequest = req.file;
    if (!uploadedFileRequest) {
      sendBadRequest(res, 'Please upload your file.');
      return;
    }

    try {
      const uploadedFile = await DifyService.uploadFile({
        file: uploadedFileRequest,
        userId,
      });

      sendSuccess(
        res,
        {
          id: uploadedFile.id,
          name: uploadedFile.name,
          size: uploadedFile.size,
          extension: uploadedFile.extension,
          mimeType: uploadedFile.mime_type,
          fileType: inferDifyFileType(uploadedFile.mime_type),
        },
        'File uploaded successfully',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File upload failed';

      if (/file size exceeded|file_too_large/i.test(message)) {
        sendError(res, message, 413);
        return;
      }

      if (/file type not allowed|unsupported_file_type/i.test(message)) {
        sendError(res, message, 415);
        return;
      }

      sendBadRequest(res, message);
    }
  }),
);

// ====================================================================
// POST /chat/audio-to-text — Convert audio file to text via Dify
// ====================================================================
const VALID_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/mpga',
  'audio/wav',
]);

const AUDIO_EXTENSION_TO_MIME_TYPE: Record<string, string> = {
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpga',
  mp4: 'audio/mp4',
  m4a: 'audio/m4a',
  wav: 'audio/wav',
};

function normalizeAudioMimeType(rawMimeType: string): string {
  const [baseMimeType] = rawMimeType.toLowerCase().split(';');
  const mimeType = baseMimeType.trim();

  // Some browsers label audio-only recordings as video/*.
  if (mimeType === 'video/webm') return 'audio/webm';
  if (mimeType === 'video/mp4') return 'audio/mp4';
  if (mimeType === 'audio/x-wav') return 'audio/wav';
  if (mimeType === 'audio/x-m4a') return 'audio/m4a';
  if (mimeType === 'audio/mp3') return 'audio/mpeg';
  if (mimeType === 'audio/m4a') return 'audio/m4a';

  return mimeType;
}

function inferAudioMimeTypeFromFilename(filename: string): string | null {
  const trimmed = filename.trim();
  if (!trimmed) return null;

  const lastDotIndex = trimmed.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === trimmed.length - 1) return null;

  const extension = trimmed.slice(lastDotIndex + 1).toLowerCase();
  return AUDIO_EXTENSION_TO_MIME_TYPE[extension] ?? null;
}

function resolveDifyAudioMimeType(file: Express.Multer.File): string | null {
  const normalizedMimeType = normalizeAudioMimeType(file.mimetype);
  if (VALID_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  return inferAudioMimeTypeFromFilename(file.originalname);
}

const audioUpload = createSingleFileUpload();

router.post(
  '/audio-to-text',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.user!;

    const uploaded = await runSingleFileUpload({
      req,
      res,
      uploader: audioUpload,
      fieldName: 'file',
      sizeExceededMessage: 'Audio file size exceeded the limit (30 MB).',
      invalidRequestMessage: 'Invalid audio upload request',
      missingFileMessage: 'Please upload your audio file.',
    });

    if (!uploaded) {
      return;
    }

    const audioFile = req.file;
    if (!audioFile) {
      sendBadRequest(res, 'Please upload your audio file.');
      return;
    }

    const normalizedAudioMimeType = resolveDifyAudioMimeType(audioFile);

    if (!normalizedAudioMimeType) {
      sendError(res, 'Audio type not allowed. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm.', 415);
      return;
    }

    try {
      const result = await DifyService.audioToText({
        file: {
          ...audioFile,
          mimetype: normalizedAudioMimeType,
        },
        userId,
      });

      sendSuccess(res, { text: result.text }, 'Audio converted to text successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio-to-text conversion failed';

      if (/audio.*size exceeded|audio_too_large/i.test(message)) {
        sendError(res, message, 413);
        return;
      }

      if (/audio type not allowed|unsupported_audio_type/i.test(message)) {
        sendError(res, message, 415);
        return;
      }

      sendBadRequest(res, message);
    }
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
    const { query, files, attachments } = req.body as {
      query?: string;
      files?: unknown;
      attachments?: unknown;
    };

    const parsedFiles = parseMessageFiles(files);
    if (parsedFiles === null) {
      sendBadRequest(
        res,
        'Invalid files payload. Only one local_file attachment with upload_file_id is supported.',
      );
      return;
    }

    const parsedAttachments = parseMessageAttachments(attachments);
    if (parsedAttachments === null) {
      sendBadRequest(res, 'Invalid attachments payload');
      return;
    }

    if (parsedFiles.length !== parsedAttachments.length) {
      sendBadRequest(res, 'attachments must match files payload');
      return;
    }

    if (
      parsedFiles.length > 0
      && parsedAttachments[0]?.id !== parsedFiles[0]?.upload_file_id
    ) {
      sendBadRequest(res, 'attachments id must match files upload_file_id');
      return;
    }

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
    await ConversationService.addMessage(
      conversationId,
      'user',
      query.trim(),
      parsedAttachments,
    );

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
        files: parsedFiles,
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
          attachments: m.attachments,
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
        attachments: m.attachments,
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
