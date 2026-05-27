import { ArrayMinSize, IsArray, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class SetUserRolesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'A user must have at least one role.' })
  @IsEnum(UserRole, {
    each: true,
    message: 'Each role must be BUYER, ADMIN, or RIDER.',
  })
  roles!: UserRole[];
}
