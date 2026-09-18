import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Order } from './order.entity';

@Entity({ name: 'service_packages' })
export class ServicePackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column() // 'job_posting' | 'cv_search' | 'combo'
  type: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'duration_days', type: 'int' })
  durationDays: number;

  @Column({ type: 'bigint' })
  price: number;

  @Column({ default: true })
  active: boolean;

  @OneToMany(() => Order, (order) => order.servicePackage)
  orders?: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
