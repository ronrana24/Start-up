import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [InventoryModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
