import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Company } from './company.entity';
import { ServicePackage } from './service-package.entity';
import { Payment } from './payment.entity';
import { Invoice } from './invoice.entity';

export enum OrderStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  VNPAY = 'vnpay',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
  VIETQR = 'vietqr',
  CONTRACT_VAT = 'contract_vat',
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ name: 'service_package_id' })
  servicePackageId: string;

  @ManyToOne(() => ServicePackage, (svc) => svc.orders)
  @JoinColumn({ name: 'service_package_id' })
  servicePackage: ServicePackage;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  remaining: number;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt?: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @OneToMany(() => Payment, (payment) => payment.order)
  payments?: Payment[];

  @OneToOne(() => Invoice, (invoice) => invoice.order)
  invoice?: Invoice;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
