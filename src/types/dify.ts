// src/types/dify.ts
export type DifyStreamEvent =
  | {
    event: 'message';
    answer?: string;
    conversation_id?: string;
    message_id?: string;
    task_id?: string;
  }
  | {
    event: 'message_end';
    conversation_id?: string;
    metadata?: Record<string, unknown>;
    task_id?: string;
  }
  | { event: 'error'; code?: string; message?: string; status?: number }
  | { event: 'ping' };

export type DifyFileType = 'image' | 'document' | 'audio' | 'video' | 'custom';

export type DifyFileTransferMethod = 'remote_url' | 'local_file';

export interface DifyChatFile {
  type: DifyFileType;
  transfer_method: DifyFileTransferMethod;
  url?: string;
  upload_file_id?: string;
}

export interface DifyFileUploadResponse {
  id: string;
  name: string;
  size: number;
  extension: string | null;
  mime_type: string | null;
  created_at: number;
}
