import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class PatchOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
