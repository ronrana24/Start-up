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
import { QueryAdminAnalyticsDto } from './dto/query-admin-analytics.dto';
import { PatchOrderStatusDto } from './dto/patch-order-status.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { OrdersService } from '../orders/orders.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly orders: OrdersService,
    private readonly admin: AdminService,
  ) {}

  @Get('analytics')
  analytics(@Query() query: QueryAdminAnalyticsDto) {
    return this.admin.analytics(query.range);
  }

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

  @Get('users')
  listUsers(@Query() query: QueryAdminUsersDto) {
    return this.admin.listUsers({
      role: query.role === 'ALL' ? undefined : (query.role ?? UserRole.BUYER),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('users/:id/analytics')
  userAnalytics(
    @Param('id') id: string,
    @Query() query: QueryAdminAnalyticsDto,
  ) {
    return this.admin.userAnalytics(id, query.range);
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
