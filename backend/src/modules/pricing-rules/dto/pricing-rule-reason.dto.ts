import { IsString, Length } from 'class-validator';

export class PricingRuleReasonDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}
