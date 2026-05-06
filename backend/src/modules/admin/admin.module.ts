import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [OrdersModule, PricingRulesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
