import { IsEnum } from 'class-validator';
import { RiderStatus } from '@prisma/client';

export class PatchRiderStatusDto {
  @IsEnum(RiderStatus)
  status!: RiderStatus;
}
