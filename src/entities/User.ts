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

  @Column({ unique: true, type: 'varchar' })
    username!: string;

  @Column({ unique: true, type: 'varchar' })
    email!: string;

  @Column({ type: 'varchar' })
    passwordHash!: string;

  @Column({ default: 'user', type: 'varchar' })
    role!: 'user' | 'admin';

  @Column({ default: true, type: 'boolean' })
    isActive!: boolean;

  @CreateDateColumn()
    createdAt!: Date;

  @UpdateDateColumn()
    updatedAt!: Date;

  @OneToMany(() => Conversation, (c) => c.user)
    conversations!: Conversation[];
}
