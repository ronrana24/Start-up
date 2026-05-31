import { IsBoolean } from 'class-validator';

export class PatchRiderAvailabilityDto {
  @IsBoolean()
  isAvailable!: boolean;
}
