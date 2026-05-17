import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductImageUploadCandidateDto {
  @IsString()
  @Length(1, 160)
  originalName!: string;

  @IsString()
  @Length(1, 80)
  contentType!: string;

  @IsNumber()
  @Min(1)
  @Max(8 * 1024 * 1024)
  size!: number;
}

export class PrepareProductImageUploadsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductImageUploadCandidateDto)
  files!: ProductImageUploadCandidateDto[];
}
