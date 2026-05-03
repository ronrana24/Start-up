import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Normalized E.164-style: + and digits, 10–15 digits after country code. */
export class SendOtpDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (/^[6-9]\d{9}$/.test(trimmed)) {
      return `+91${trimmed}`;
    }
    return trimmed;
  })
  @MinLength(13)
  @MaxLength(13)
  @Matches(/^\+91[6-9]\d{9}$/, {
    message:
      'phone must be a valid Indian mobile number in +91 format (or 10 digits starting 6-9)',
  })
  phone!: string;
}
