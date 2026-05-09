import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { OrdersModule } from '../orders/orders.module';
import { RidersController } from './riders.controller';
import { RidersService } from './riders.service';

@Module({
  imports: [DeliveryModule, OrdersModule],
  controllers: [RidersController],
  providers: [RidersService],
})
export class RidersModule {}
