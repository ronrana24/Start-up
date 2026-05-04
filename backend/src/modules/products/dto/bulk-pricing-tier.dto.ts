import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class BulkPricingTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minQty!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}
