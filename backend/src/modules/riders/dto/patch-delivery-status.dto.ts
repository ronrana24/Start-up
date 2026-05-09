import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class PatchDeliveryStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
