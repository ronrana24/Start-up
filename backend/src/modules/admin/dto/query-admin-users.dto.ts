import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRole } from '@prisma/client';

export type AdminUserRoleFilter = UserRole | 'ALL';
const ADMIN_USER_ROLE_FILTERS = [...Object.values(UserRole), 'ALL'];

export class QueryAdminUsersDto {
  @IsOptional()
  @IsIn(ADMIN_USER_ROLE_FILTERS)
  role?: AdminUserRoleFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
