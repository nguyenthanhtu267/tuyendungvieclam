import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';
import { PaymentMethod } from '../../database/entities/order.entity';

export class CreateOrderDto {
  @IsUUID()
  servicePackageId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod, { message: 'Phương thức thanh toán không hợp lệ' })
  paymentMethod: PaymentMethod;
}
