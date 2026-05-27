import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PricingRuleReasonDto } from '../pricing-rules/dto/pricing-rule-reason.dto';
import { UpsertPricingRuleDto } from '../pricing-rules/dto/upsert-pricing-rule.dto';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';
import { AssignRiderDto } from './dto/assign-rider.dto';
import { QueryAdminAnalyticsDto } from './dto/query-admin-analytics.dto';
import { PatchOrderStatusDto } from './dto/patch-order-status.dto';
import { QueryAdminOrdersDto } from './dto/query-admin-orders.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { SetUserRolesDto } from './dto/set-user-roles.dto';
import { OrdersService } from '../orders/orders.service';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly orders: OrdersService,
    private readonly admin: AdminService,
    private readonly pricingRules: PricingRulesService,
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

  @Get('users/:id')
  userProfile(@Param('id') id: string) {
    return this.admin.userProfile(id);
  }

  @Patch('users/:id/roles')
  setUserRoles(@Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.admin.setUserRoles(id, dto.roles);
  }

  @Get('products/:id/analytics')
  productAnalytics(
    @Param('id') id: string,
    @Query() query: QueryAdminAnalyticsDto,
  ) {
    return this.admin.productAnalytics(id, query.range);
  }

  @Get('users/:userId/pricing-rules')
  listUserPricingRules(@Param('userId') userId: string) {
    return this.pricingRules.listForUser(userId);
  }

  @Put('users/:userId/products/:productId/pricing-rule')
  upsertUserProductPricingRule(
    @Param('userId') userId: string,
    @Param('productId') productId: string,
    @Body() dto: UpsertPricingRuleDto,
    @CurrentUser() admin: User,
  ) {
    return this.pricingRules.upsertForUserProduct(
      userId,
      productId,
      dto,
      admin,
    );
  }

  @Get('users/:id/analytics')
  userAnalytics(
    @Param('id') id: string,
    @Query() query: QueryAdminAnalyticsDto,
  ) {
    return this.admin.userAnalytics(id, query.range);
  }

  @Patch('pricing-rules/:id/disable')
  disablePricingRule(
    @Param('id') id: string,
    @Body() dto: PricingRuleReasonDto,
    @CurrentUser() admin: User,
  ) {
    return this.pricingRules.setRuleActive(id, false, dto.reason, admin);
  }

  @Patch('pricing-rules/:id/enable')
  enablePricingRule(
    @Param('id') id: string,
    @Body() dto: PricingRuleReasonDto,
    @CurrentUser() admin: User,
  ) {
    return this.pricingRules.setRuleActive(id, true, dto.reason, admin);
  }

  @Get('pricing-rules/:id/audit')
  pricingRuleAudit(@Param('id') id: string) {
    return this.pricingRules.auditForRule(id);
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
