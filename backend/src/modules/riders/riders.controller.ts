import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PatchDeliveryStatusDto } from './dto/patch-delivery-status.dto';
import { PatchRiderLocationDto } from './dto/patch-rider-location.dto';
import { PatchRiderStatusDto } from './dto/patch-rider-status.dto';
import { QueryAvailableOrdersDto } from './dto/query-available-orders.dto';
import { QueryRiderOrderHistoryDto } from './dto/query-rider-order-history.dto';
import { RegisterRiderDeviceDto } from './dto/register-rider-device.dto';
import { RidersService } from './riders.service';

@Controller('riders')
@UseGuards(RolesGuard)
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list() {
    return this.riders.list();
  }

  @Get('me')
  @Roles(UserRole.RIDER)
  me(@CurrentUser() user: User) {
    return this.riders.me(user);
  }

  @Get('orders/available')
  @Roles(UserRole.RIDER)
  availableOrders(
    @CurrentUser() user: User,
    @Query() query: QueryAvailableOrdersDto,
  ) {
    return this.riders.availableOrders(user, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('orders/active')
  @Roles(UserRole.RIDER)
  activeOrder(@CurrentUser() user: User) {
    return this.riders.activeOrder(user);
  }

  @Get('orders/active-list')
  @Roles(UserRole.RIDER)
  activeOrders(@CurrentUser() user: User) {
    return this.riders.activeOrders(user);
  }

  @Get('orders/history')
  @Roles(UserRole.RIDER)
  orderHistory(
    @CurrentUser() user: User,
    @Query() query: QueryRiderOrderHistoryDto,
  ) {
    return this.riders.orderHistory(user, {
      period: query.period,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Get('orders/:id')
  @Roles(UserRole.RIDER)
  orderDetails(@CurrentUser() user: User, @Param('id') id: string) {
    return this.riders.orderDetails(user, id);
  }

  @Post('devices')
  @Roles(UserRole.RIDER)
  registerDevice(
    @CurrentUser() user: User,
    @Body() dto: RegisterRiderDeviceDto,
  ) {
    return this.riders.registerDevice(user, dto);
  }

  @Post('orders/:id/claim')
  @Roles(UserRole.RIDER)
  claimOrder(@CurrentUser() user: User, @Param('id') id: string) {
    return this.riders.claimOrder(user, id);
  }

  @Patch('orders/:id/status')
  @Roles(UserRole.RIDER)
  patchDeliveryStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: PatchDeliveryStatusDto,
  ) {
    return this.riders.patchDeliveryStatus(user, id, dto);
  }

  @Patch('me/location')
  @Roles(UserRole.RIDER)
  patchMyLocation(
    @CurrentUser() user: User,
    @Body() dto: PatchRiderLocationDto,
  ) {
    return this.riders.patchMyLocation(user, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  patchStatus(@Param('id') id: string, @Body() dto: PatchRiderStatusDto) {
    return this.riders.patchStatus(id, dto);
  }

  @Patch(':id/location')
  @Roles(UserRole.ADMIN)
  patchLocation(@Param('id') id: string, @Body() dto: PatchRiderLocationDto) {
    return this.riders.patchLocation(id, dto);
  }
}
