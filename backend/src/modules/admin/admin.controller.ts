import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignRiderDto } from './dto/assign-rider.dto';
import { PatchOrderStatusDto } from './dto/patch-order-status.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { OrdersService } from '../orders/orders.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders')
  listOrders(@Query() query: QueryAdminOrdersDto) {
    return this.orders.adminList({
      status: query.status,
      deliveryType: query.deliveryType,
      userId: query.userId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Patch('orders/:id/status')
  patchStatus(@Param('id') id: string, @Body() dto: PatchOrderStatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Patch('orders/:id/assign-rider')
  assignRider(@Param('id') id: string, @Body() dto: AssignRiderDto) {
    return this.orders.assignRider(id, dto.riderId);
  }
}
