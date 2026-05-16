import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionStatus,
  DeliveryType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  RiderStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { DeliveryPushService } from '../delivery/delivery-push.service';
import { InventoryService } from '../inventory/inventory.service';
import { UsersService } from '../users/users.service';
import { CheckoutPaymentOption, CreateOrderDto } from './dto/create-order.dto';
import { OrderListPeriod } from './dto/list-orders-query.dto';
import type { UserOrdersListResponse } from './order-list.types';
import {
  assertOrderStatusTransition,
  isTerminalStatus,
} from './order-state-machine';
import { mergeQuantitiesByProductId } from './merge-order-items';
import { PaymentsService } from './payments.service';
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

const deliveryOrderInclude = {
  items: { include: adminOrderItemsInclude },
  rider: true,
  user: { select: adminOrderUserSelect },
} satisfies Prisma.OrderInclude;

const riderAvailableStatuses: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
];

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
    private readonly deliveryEvents: DeliveryEventsService,
    private readonly deliveryPush: DeliveryPushService,
    private readonly payments: PaymentsService,
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
    const paymentSummary = this.payments.paymentSummaryForCreate(
      total,
      dto.paymentOption === CheckoutPaymentOption.PARTIAL_UPI,
    );

    const coordinates =
      typeof address.latitude === 'number' &&
      Number.isFinite(address.latitude) &&
      typeof address.longitude === 'number' &&
      Number.isFinite(address.longitude)
        ? {
            lat: address.latitude,
            lng: address.longitude,
            accuracyMeters: address.locationAccuracyMeters,
            source: address.locationSource ?? 'buyer_pin',
          }
        : null;

    const addressSnapshot = {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      ...(dto.orderNotes?.trim()
        ? { deliveryNotes: dto.orderNotes.trim() }
        : {}),
      ...(coordinates ? { coordinates } : {}),
    };

    const order = await this.prisma.$transaction(
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
            paymentMode: paymentSummary.paymentMode,
            paymentStatus: PaymentStatus.PENDING,
            paidAmount: 0,
            dueAmount: paymentSummary.dueAmount,
            paymentCollectionRequired: paymentSummary.paymentCollectionRequired,
            collectionStatus: paymentSummary.collectionStatus,
            collectionInstructions: paymentSummary.collectionInstructions,
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

    const fullOrder = await this.getDeliveryOrderOrThrow(order.id);
    let payment: Awaited<ReturnType<PaymentsService['createCheckoutPayment']>>;
    try {
      payment = await this.payments.createCheckoutPayment(
        fullOrder,
        paymentSummary.paidNow,
      );
    } catch (error) {
      await this.cancelUnpaidOrderReservation(
        order.id,
        'Payment checkout could not be started.',
      );
      throw error;
    }
    return { order: fullOrder, payment };
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
      paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] },
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
      paymentMode: o.paymentMode,
      paymentStatus: o.paymentStatus,
      paidAmount: o.paidAmount.toString(),
      dueAmount: o.dueAmount.toString(),
      paymentCollectionRequired: o.paymentCollectionRequired,
      collectionStatus: o.collectionStatus,
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
          paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 5 },
          paymentAudits: { orderBy: { createdAt: 'desc' }, take: 10 },
          collectionEvents: { orderBy: { collectedAt: 'desc' }, take: 5 },
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
        include: deliveryOrderInclude,
      });
    }
    assertOrderStatusTransition(order.status, next);
    if (
      next === OrderStatus.DELIVERED &&
      order.paymentCollectionRequired &&
      order.collectionStatus !== CollectionStatus.COLLECTED
    ) {
      throw new BadRequestException(
        'Record the pending delivery collection before marking this order delivered.',
      );
    }

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
      if (next === OrderStatus.DELIVERED && order.status !== next) {
        for (const item of order.items) {
          await this.inventory.consumeReservedInTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }
      }

      if (
        (next === OrderStatus.DELIVERED || next === OrderStatus.CANCELLED) &&
        order.riderId
      ) {
        const remainingActiveOrders = await tx.order.count({
          where: {
            riderId: order.riderId,
            id: { not: orderId },
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
          },
        });
        if (remainingActiveOrders === 0) {
          await tx.rider.update({
            where: { id: order.riderId },
            data: { status: RiderStatus.IDLE },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: next,
          ...(next === OrderStatus.PICKED_UP ? { pickedUpAt: new Date() } : {}),
          ...(next === OrderStatus.DELIVERED
            ? { deliveredAt: new Date() }
            : {}),
        },
      });
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: deliveryOrderInclude,
    });
    if (updated) {
      this.deliveryEvents.orderStatusChanged(updated);
      if (!updated.riderId && riderAvailableStatuses.includes(updated.status)) {
        this.deliveryEvents.orderAvailable(updated);
        void this.deliveryPush.notifyAvailableRiders(updated);
      }
      if (
        order.riderId &&
        (next === OrderStatus.DELIVERED || next === OrderStatus.CANCELLED)
      ) {
        const remainingActiveOrders = await this.prisma.order.count({
          where: {
            riderId: order.riderId,
            id: { not: orderId },
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
          },
        });
        this.deliveryEvents.riderAvailabilityChanged({
          riderId: order.riderId,
          available: remainingActiveOrders === 0,
          reason: 'order_terminal',
        });
      }
    }
    return updated;
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

    const riderAssignableStatuses: OrderStatus[] = [
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
    ];
    const shouldMarkAssigned = riderAssignableStatuses.includes(order.status);
    const nextStatus = shouldMarkAssigned
      ? OrderStatus.RIDER_ASSIGNED
      : order.status;
    assertOrderStatusTransition(order.status, nextStatus);

    await this.prisma.$transaction(async (tx) => {
      if (order.riderId && order.riderId !== riderId) {
        const oldRiderActiveOrders = await tx.order.count({
          where: {
            riderId: order.riderId,
            id: { not: orderId },
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
          },
        });
        if (oldRiderActiveOrders === 0) {
          await tx.rider.update({
            where: { id: order.riderId },
            data: { status: RiderStatus.IDLE },
          });
        }
      }
      await tx.rider.update({
        where: { id: riderId },
        data: { status: RiderStatus.BUSY },
      });
      await tx.order.update({
        where: { id: orderId },
        data: { riderId, status: nextStatus },
      });
    });

    const updated = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: deliveryOrderInclude,
    });
    if (updated) {
      if (order.riderId && order.riderId !== riderId) {
        const oldRiderActiveOrders = await this.prisma.order.count({
          where: {
            riderId: order.riderId,
            id: { not: orderId },
            status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
          },
        });
        this.deliveryEvents.riderAvailabilityChanged({
          riderId: order.riderId,
          available: oldRiderActiveOrders === 0,
          reason: 'order_reassigned',
        });
      }
      this.deliveryEvents.riderAvailabilityChanged({
        riderId,
        available: false,
        reason: 'order_assigned',
      });
      this.deliveryEvents.orderAssigned(updated);
    }
    return updated;
  }

  private async getDeliveryOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: deliveryOrderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async cancelUnpaidOrderReservation(orderId: string, reason: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (
        !order ||
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.DELIVERED
      ) {
        return;
      }
      for (const item of order.items) {
        await this.inventory.releaseReservationInTransaction(
          tx,
          item.productId,
          item.quantity,
        );
      }
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
        },
      });
      await tx.paymentAudit.create({
        data: {
          orderId,
          eventType: 'PAYMENT_ORDER_CREATION_FAILED',
          message: reason,
          previousStatus: order.paymentStatus,
          nextStatus: PaymentStatus.FAILED,
        },
      });
    });
  }
}
