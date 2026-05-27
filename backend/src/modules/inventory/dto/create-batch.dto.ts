import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { BulkTierDto } from './bulk-tier.dto';

export class CreateInventoryBatchDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  /** At least 1, at most 3 tiers per the spec. */
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 bulk tier is required.' })
  @ArrayMaxSize(3, { message: 'A batch can have at most 3 bulk tiers.' })
  @ValidateNested({ each: true })
  @Type(() => BulkTierDto)
  bulkTiers!: BulkTierDto[];
}
