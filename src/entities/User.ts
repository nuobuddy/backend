import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from './Conversation';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
    id!: string;

  @Column({ unique: true })
    username!: string;

  @Column({ unique: true })
    email!: string;

  @Column()
    passwordHash!: string;

  @Column({ default: 'user' })
    role!: 'user' | 'admin';

  @Column({ default: true })
    isActive!: boolean;

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;

  @OneToMany(() => Conversation, (c) => c.user)
    conversations!: Conversation[];
}
