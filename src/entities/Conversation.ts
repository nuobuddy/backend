import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { Message } from './Message';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ nullable: true, type: 'varchar' })
    difyConversationId!: string | null;

  @Column({ nullable: true, type: 'varchar' })
    title!: string | null;

  @Column({ default: false, type: 'boolean' })
    share!: boolean;

  @ManyToOne(() => User, (u) => u.conversations, { onDelete: 'CASCADE' })
    user!: User;

  @Column({ type: 'uuid' })
    userId!: string;

  @OneToMany(() => Message, (m) => m.conversation)
    messages!: Message[];

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;
}
