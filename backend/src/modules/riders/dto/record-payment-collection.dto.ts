import { CollectionMethod } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class RecordPaymentCollectionDto {
  @IsEnum(CollectionMethod)
  method!: CollectionMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(0, 128)
  reference?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  note?: string;
}
