import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [InventoryModule, UsersModule, PricingRulesModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
