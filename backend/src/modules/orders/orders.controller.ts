import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { QuoteCartDto } from './dto/quote-cart.dto';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly pricing: PricingService,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.orders.create(user, dto);
  }

  /**
   * Live cart quote: returns the FIFO batch split that would apply if the
   * buyer checked out right now, so the cart screen can render split
   * pricing rows (e.g. "5 × ₹70, 5 × ₹85").
   */
  @Post('quote')
  quote(@CurrentUser() user: User, @Body() dto: QuoteCartDto) {
    return this.pricing.quoteCart(user, dto.items);
  }

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListOrdersQueryDto) {
    return this.orders.listForUserWithSummary(user.id, query.period);
  }

  @Get(':id')
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.orders.getOneForUser(user.id, id);
  }
}
