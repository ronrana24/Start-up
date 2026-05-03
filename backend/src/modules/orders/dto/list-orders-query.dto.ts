import { IsEnum } from 'class-validator';

export enum OrderListPeriod {
  THIS_MONTH = 'this_month',
  LAST_3_MONTHS = 'last_3_months',
  ALL_TIME = 'all_time',
}

export class ListOrdersQueryDto {
  @IsEnum(OrderListPeriod)
  period!: OrderListPeriod;
}
