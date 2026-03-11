import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './User';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ nullable: true, type: 'varchar' })
    difyConversationId!: string | null;

  @Column({ nullable: true, type: 'varchar' })
    title!: string | null;

  @ManyToOne(() => User, (u) => u.conversations, { onDelete: 'CASCADE' })
    user!: User;

  @Column()
    userId!: string;

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;
}
