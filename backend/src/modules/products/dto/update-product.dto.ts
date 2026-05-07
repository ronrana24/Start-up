import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
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

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  piecesPerPack?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPricingTierDto)
  bulkPricingTiers?: BulkPricingTierDto[];

  @IsOptional()
  @IsArray()
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: false,
    },
    { each: true },
  )
  imageUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialAvailableQty?: number;
}
