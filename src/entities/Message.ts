import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Conversation } from './Conversation';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ type: 'varchar' })
    role!: 'user' | 'assistant';

  @Column({ type: 'text' })
    content!: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
    conversation!: Conversation;

  @Column({ type: 'uuid' })
    conversationId!: string;

  @CreateDateColumn({ name: 'timestamp' })
    timestamp!: Date;
}
