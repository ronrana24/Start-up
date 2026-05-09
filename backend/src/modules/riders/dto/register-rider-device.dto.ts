import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RegisterRiderDeviceDto {
  @IsString()
  @Length(8, 256)
  pushToken!: string;

  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';
}
