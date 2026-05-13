import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
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
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  locationAccuracyMeters?: number;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  locationSource?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
