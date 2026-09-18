import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from './company.entity';
import { User } from './user.entity';

export enum CompanyUserType {
  MAIN = 'main', // Tài khoản Chính
  SUB = 'sub', // Tài khoản Phụ
}

// SRS Mục 10: liên kết User – Company (nhiều-nhiều qua bảng này)
@Entity({ name: 'company_users' })
export class CompanyUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.companyUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.companyUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: CompanyUserType, default: CompanyUserType.SUB })
  type: CompanyUserType;

  @Column({ name: 'permissions', type: 'simple-array', nullable: true })
  permissions?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
