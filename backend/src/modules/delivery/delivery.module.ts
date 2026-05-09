import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { DeliveryEventsService } from './delivery-events.service';
import { DeliveryGateway } from './delivery.gateway';
import { DeliveryPushService } from './delivery-push.service';

@Module({
  imports: [JwtModule, PrismaModule],
  providers: [DeliveryGateway, DeliveryEventsService, DeliveryPushService],
  exports: [DeliveryEventsService, DeliveryPushService],
})
export class DeliveryModule {}
