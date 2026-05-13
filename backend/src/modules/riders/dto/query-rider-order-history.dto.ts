import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderListPeriod } from '../../orders/dto/list-orders-query.dto';

export class QueryRiderOrderHistoryDto {
  @IsOptional()
  @IsEnum(OrderListPeriod)
  period?: OrderListPeriod = OrderListPeriod.THIS_MONTH;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
