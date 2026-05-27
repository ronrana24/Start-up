import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ProductCategory, ProductUnit } from '@prisma/client';
import { BulkTierDto } from '../../inventory/dto/bulk-tier.dto';

export class InitialInventoryBatchDto {
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

  /** At least 1 tier (mandatory per spec), at most 3. */
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 bulk tier is required.' })
  @ArrayMaxSize(3, { message: 'A batch can have at most 3 bulk tiers.' })
  @ValidateNested({ each: true })
  @Type(() => BulkTierDto)
  bulkTiers!: BulkTierDto[];
}

export class CreateProductDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsEnum(ProductUnit)
  unit!: ProductUnit;

  @ValidateIf((dto: CreateProductDto) => dto.unit === ProductUnit.PACK)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  piecesPerPack?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(4, { message: 'Add at least 4 product images.' })
  @ArrayMaxSize(10, { message: 'You can add up to 10 product images.' })
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: false,
    },
    { each: true },
  )
  imageUrls?: string[];

  /** First inventory batch (batchNumber = 1) created alongside the product. */
  @ValidateNested()
  @Type(() => InitialInventoryBatchDto)
  initialBatch!: InitialInventoryBatchDto;
}
