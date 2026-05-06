import { Module } from '@nestjs/common';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PricingRulesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
