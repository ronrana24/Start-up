import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PricingRulesModule } from '../pricing-rules/pricing-rules.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [InventoryModule, UsersModule, PricingRulesModule, DeliveryModule],
  controllers: [OrdersController, PaymentsController],
  providers: [OrdersService, PricingService, PaymentsService],
  exports: [OrdersService],
})
export class OrdersModule {}
