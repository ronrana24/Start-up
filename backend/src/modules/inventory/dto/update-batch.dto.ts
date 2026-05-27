import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { BulkTierDto } from './bulk-tier.dto';

export class UpdateInventoryBatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 bulk tier is required.' })
  @ArrayMaxSize(3, { message: 'A batch can have at most 3 bulk tiers.' })
  @ValidateNested({ each: true })
  @Type(() => BulkTierDto)
  bulkTiers?: BulkTierDto[];
}
