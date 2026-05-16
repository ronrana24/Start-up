import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DeliveryType } from '@prisma/client';
import { OrderItemInputDto } from './order-item-input.dto';

export enum CheckoutPaymentOption {
  FULL_UPI = 'FULL_UPI',
  PARTIAL_UPI = 'PARTIAL_UPI',
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @IsString()
  @Length(1, 64)
  addressId!: string;

  @IsEnum(CheckoutPaymentOption)
  paymentOption!: CheckoutPaymentOption;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  orderNotes?: string;
}
