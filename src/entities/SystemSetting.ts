import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar' })
    key!: string;

  @Column({ type: 'text' })
    value!: string;

  @Column({ nullable: true, type: 'varchar' })
    description!: string | null;

  @UpdateDateColumn()
    updatedAt!: Date;
}
