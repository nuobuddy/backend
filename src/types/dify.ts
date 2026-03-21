// src/types/dify.ts
export type DifyStreamEvent =
  | { event: 'message'; answer: string; conversation_id: string; message_id: string }
  | { event: 'message_end'; conversation_id: string; metadata: Record<string, unknown> }
  | { event: 'error'; code: string; message: string; status: number }
  | { event: 'ping' };
