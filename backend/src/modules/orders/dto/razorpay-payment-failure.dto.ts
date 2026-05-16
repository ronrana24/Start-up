import { IsOptional, IsString, Length } from 'class-validator';

export class RazorpayPaymentFailureDto {
  @IsString()
  @Length(1, 128)
  razorpayOrderId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  razorpayPaymentId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  errorCode?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  errorDescription?: string;
}
