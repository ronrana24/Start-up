import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryType,
  OrderStatus,
  Prisma,
  RiderStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { UsersService } from '../users/users.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderListPeriod } from './dto/list-orders-query.dto';
import type { UserOrdersListResponse } from './order-list.types';
import {
  assertOrderStatusTransition,
  isTerminalStatus,
} from './order-state-machine';
import { mergeQuantitiesByProductId } from './merge-order-items';
import { PricingService } from './pricing.service';

const adminOrderUserSelect = {
  id: true,
  phone: true,
  email: true,
  name: true,
  businessName: true,
  businessType: true,
  gstNumber: true,
  role: true,
} satisfies Prisma.UserSelect;

const adminOrderItemsInclude = {
  product: {
    select: {
      id: true,
      name: true,
      category: true,
      unit: true,
      imageUrls: true,
    },
  },
} satisfies Prisma.OrderItemInclude;

function mapOrderStatusToLineStatus(
  status: OrderStatus,
): 'delivered' | 'processing' | 'other' {
  if (status === OrderStatus.DELIVERED) {
    return 'delivered';
  }
  if (status === OrderStatus.CANCELLED) {
    return 'other';
  }
  return 'processing';
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
    private readonly users: UsersService,
  ) {}

  async create(user: User, dto: CreateOrderDto) {
    const address = await this.users.assertAddressOwned(user.id, dto.addressId);
    const merged = mergeQuantitiesByProductId(dto.items);
    const productIds = [...merged.keys()];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { inventory: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products were not found');
    }

    const lines = productIds.map((productId) => {
      const product = products.find((p) => p.id === productId)!;
      const qty = merged.get(productId)!;
      const inv = product.inventory;
      if (!inv) {
        throw new BadRequestException(
          `Product ${productId} has no inventory record`,
        );
      }
      if (inv.availableQty < qty) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}`,
        );
      }
      return { product, quantity: qty };
    });

    const { pricedLines, subtotal, deliveryFee, total } =
      await this.pricing.computeOrderTotals(user, lines, dto.deliveryType);

    const addressSnapshot = {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    };

    return this.prisma.$transaction(
      async (tx) => {
        for (const line of pricedLines) {
          await this.inventory.reserveInTransaction(
            tx,
            line.productId,
            line.quantity,
          );
        }

        const order = await tx.order.create({
          data: {
            userId: user.id,
            status: OrderStatus.PLACED,
            deliveryType: dto.deliveryType,
            deliveryFee,
            subtotalAmount: subtotal,
            totalAmount: total,
            addressSnapshot,
            items: {
              create: pricedLines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                priceApplied: l.unitPrice,
                pricingSnapshot: l.pricingSnapshot,
              })),
            },
          },
          include: { items: true },
        });
        return order;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /** Lower bound (inclusive) for `createdAt` in UTC; `undefined` means all time. */
  private orderCreatedAtLowerBound(period: OrderListPeriod): Date | undefined {
    if (period === OrderListPeriod.ALL_TIME) {
      return undefined;
    }
    const now = new Date();
    if (period === OrderListPeriod.THIS_MONTH) {
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
      );
    }
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0, 0),
    );
  }

  async listForUserWithSummary(
    userId: string,
    period: OrderListPeriod = OrderListPeriod.THIS_MONTH,
  ): Promise<UserOrdersListResponse> {
    const filter = period ?? OrderListPeriod.THIS_MONTH;
    const gte = this.orderCreatedAtLowerBound(filter);
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(gte ? { createdAt: { gte } } : {}),
    };

    const [rows, totalOrders, agg] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
    ]);

    const sum = agg._sum.totalAmount;
    const totalSpending = sum != null ? sum.toString() : '0';

    const orders = rows.map((o) => ({
      orderId: o.id,
      orderAmount: o.totalAmount.toString(),
      orderDate: o.createdAt.toISOString(),
      items: o.items.map((line) => ({
        productId: line.productId,
        name: line.product.name,
        quantity: line.quantity,
        priceApplied: line.priceApplied.toString(),
        status: mapOrderStatusToLineStatus(o.status),
      })),
    }));

    return { filter, totalOrders, totalSpending, orders };
  }

  async getOneForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: { select: { name: true } } } },
        rider: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  adminList(params: {
    status?: OrderStatus;
    deliveryType?: DeliveryType;
    userId?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.OrderWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.deliveryType) where.deliveryType = params.deliveryType;
    if (params.userId) where.userId = params.userId;

    return Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: adminOrderItemsInclude },
          user: {
            select: {
              ...adminOrderUserSelect,
            },
          },
          rider: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    }));
  }

  async updateStatus(orderId: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status === next) {
      return this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: adminOrderItemsInclude },
          rider: true,
          user: { select: adminOrderUserSelect },
        },
      });
    }
    assertOrderStatusTransition(order.status, next);

    await this.prisma.$transaction(async (tx) => {
      if (next === OrderStatus.CANCELLED && !isTerminalStatus(order.status)) {
        for (const item of order.items) {
          await this.inventory.releaseReservationInTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }
      }
      if (
        next === OrderStatus.DELIVERED &&
        order.status !== OrderStatus.DELIVERED
      ) {
        for (const item of order.items) {
          await this.inventory.consumeReservedInTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }
        if (order.riderId) {
          await tx.rider.update({
            where: { id: order.riderId },
            data: { status: RiderStatus.IDLE },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: next },
      });
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: adminOrderItemsInclude },
        rider: true,
        user: { select: adminOrderUserSelect },
      },
    });
  }

  async assignRider(orderId: string, riderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { rider: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (isTerminalStatus(order.status)) {
      throw new BadRequestException('Cannot assign rider to a terminal order');
    }

    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
    });
    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    await this.prisma.$transaction(async (tx) => {
      if (order.riderId && order.riderId !== riderId) {
        await tx.rider.update({
          where: { id: order.riderId },
          data: { status: RiderStatus.IDLE },
        });
      }
      await tx.rider.update({
        where: { id: riderId },
        data: { status: RiderStatus.BUSY },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { riderId },
      });
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        rider: true,
        user: { select: adminOrderUserSelect },
      },
    });
  }
}
