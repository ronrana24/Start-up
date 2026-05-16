import { IsString, Length } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @IsString()
  @Length(1, 128)
  razorpayOrderId!: string;

  @IsString()
  @Length(1, 128)
  razorpayPaymentId!: string;

  @IsString()
  @Length(1, 256)
  razorpaySignature!: string;
}
