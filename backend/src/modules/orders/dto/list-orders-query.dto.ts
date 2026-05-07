import { IsEnum, IsOptional } from 'class-validator';

export enum OrderListPeriod {
  THIS_MONTH = 'this_month',
  LAST_3_MONTHS = 'last_3_months',
  ALL_TIME = 'all_time',
}

export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderListPeriod)
  period: OrderListPeriod = OrderListPeriod.THIS_MONTH;
}
