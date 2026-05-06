import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductUnit } from '@prisma/client';
import { BulkPricingTierDto } from './bulk-pricing-tier.dto';

export class CreateProductDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  @Length(1, 100)
  category!: string;

  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPricingTierDto)
  bulkPricingTiers!: BulkPricingTierDto[];

  @IsOptional()
  @IsArray()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { each: true },
  )
  imageUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialAvailableQty?: number;
}
