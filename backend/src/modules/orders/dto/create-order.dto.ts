import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DeliveryType } from '@prisma/client';
import { OrderItemInputDto } from './order-item-input.dto';

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
}
