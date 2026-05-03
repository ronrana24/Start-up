import { IsString, Length } from 'class-validator';

export class AssignRiderDto {
  @IsString()
  @Length(1, 64)
  riderId!: string;
}
