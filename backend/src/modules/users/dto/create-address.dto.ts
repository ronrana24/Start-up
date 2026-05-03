import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Length(1, 200)
  line1!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  line2?: string;

  @IsString()
  @Length(1, 100)
  city!: string;

  @IsString()
  @Length(1, 100)
  state!: string;

  @IsString()
  @Length(4, 10)
  @Matches(/^[0-9A-Za-z\- ]+$/)
  pincode!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
