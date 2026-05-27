import { Type } from 'class-transformer';
import { IsInt, IsNumber, Min } from 'class-validator';

export class BulkTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minimumQuantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerUnit!: number;
}
