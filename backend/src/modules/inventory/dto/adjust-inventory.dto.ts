import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdjustInventoryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  availableQty!: number;
}
