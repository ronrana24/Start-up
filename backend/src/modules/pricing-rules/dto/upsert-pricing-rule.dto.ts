import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PricingDiscountType } from '@prisma/client';

export class UpsertPricingRuleDto {
  @IsEnum(PricingDiscountType)
  discountType!: PricingDiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  adminNote?: string;
}
