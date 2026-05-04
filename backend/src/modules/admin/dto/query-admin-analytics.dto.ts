import { IsIn, IsOptional } from 'class-validator';

export const ADMIN_ANALYTICS_RANGES = ['7d', '30d', '90d', 'all'] as const;
export type AdminAnalyticsRange = (typeof ADMIN_ANALYTICS_RANGES)[number];

export class QueryAdminAnalyticsDto {
  @IsOptional()
  @IsIn(ADMIN_ANALYTICS_RANGES)
  range?: AdminAnalyticsRange;
}
