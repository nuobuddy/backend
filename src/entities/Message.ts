import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Conversation } from './Conversation';

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  fileType: 'image' | 'document' | 'audio' | 'video' | 'custom';
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ type: 'varchar' })
    role!: 'user' | 'assistant';

  @Column({ type: 'text' })
    content!: string;

  @Column({ type: 'jsonb', nullable: true })
    attachments!: MessageAttachment[] | null;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
    conversation!: Conversation;

  @Column({ type: 'uuid' })
    conversationId!: string;

  @CreateDateColumn({ name: 'timestamp' })
    timestamp!: Date;
}
