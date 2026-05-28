import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
  roles: true,
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
  batchAllocations: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      batch: {
        select: {
          batchNumber: true,
          sellingPrice: true,
          costPrice: true,
        },
      },
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

/** Postgres serialization-failure (40001), surfaced by Prisma as P2034. */
const PRISMA_SERIALIZATION_ERROR_CODE = 'P2034';
/** Postgres write conflict (40P01 / 40001 variants). */
const PRISMA_DEADLOCK_ERROR_CODE = 'P2024';
const ORDER_TX_MAX_ATTEMPTS = 3;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
    private readonly users: UsersService,
    private readonly deliveryEvents: DeliveryEventsService,
    private readonly deliveryPush: DeliveryPushService,
    private readonly payments: PaymentsService,
  ) { }

  /**
   * Retry the serializable order-creation transaction on transient
   * Postgres serialization failures (P2034) / lock timeouts (P2024).
   * Other errors are propagated immediately. After the final attempt
   * we surface a friendly `ConflictException` instead of leaking the
   * underlying Prisma error to the buyer.
   */
  private async runSerializableOrderTx<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= ORDER_TX_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        lastError = error;
        if (error instanceof ConflictException) {
          throw error;
        }
        const code = (error as { code?: string })?.code;
        const transient =
          code === PRISMA_SERIALIZATION_ERROR_CODE ||
          code === PRISMA_DEADLOCK_ERROR_CODE;
        if (!transient || attempt === ORDER_TX_MAX_ATTEMPTS) {
          if (transient) {
            this.logger.warn(
              `Order transaction failed after ${attempt} attempts: ${code}`,
            );
            throw new ConflictException({
              code: 'CONFLICT',
              message:
                'Other buyers were checking out at the same moment. Please review your cart and try again.',
            });
          }
          throw error;
        }
        this.logger.debug(
          `Order transaction retrying (${attempt}/${ORDER_TX_MAX_ATTEMPTS}) after ${code}`,
        );
      }
    }
    // Unreachable, but keeps TS happy if the loop exits without returning.
    throw lastError instanceof Error
      ? lastError
      : new ConflictException({
        code: 'CONFLICT',
        message: 'Could not place order. Please try again.',
      });
  }

  async create(user: User, dto: CreateOrderDto) {
    const address = await this.users.assertAddressOwned(user.id, dto.addressId);
    const merged = mergeQuantitiesByProductId(dto.items);
    const productIds = [...merged.keys()];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { batches: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products were not found');
    }

    const lines = productIds.map((productId) => {
      const product = products.find((p) => p.id === productId)!;
      const qty = merged.get(productId)!;
      const totalAvailable = product.batches.reduce(
        (n, b) => n + b.quantity,
        0,
      );
      if (totalAvailable < qty) {
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

    const order = await this.runSerializableOrderTx(
      async (tx) => {
        // Re-allocate inside the serializable tx so the price segments the
        // buyer is charged exactly match the batches we decrement. We can't
        // reuse the pre-tx allocation snapshot because another buyer may
        // have drained a batch between quote and place.
        type CommittedLine = {
        productId: string;
          quantity: number;
          allocations: Array<{
            batchId: string;
            batchNumber: number;
            quantity: number;
            unitPrice: Prisma.Decimal;
            lineTotal: Prisma.Decimal;
          }>;
          blendedUnitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
          pricingSnapshot: Prisma.InputJsonValue;
        };
        const committed: CommittedLine[] = [];
        let committedSubtotal = new Prisma.Decimal(0);
        for (const line of pricedLines) {
          const allocations = await this.inventory.reserveInTransaction(
            tx,
            line.productId,
            line.quantity,
          );
          // Recompute pricing from the fresh allocations using the same
          // tier + special-rule logic the cart preview used. This keeps the
          // recorded snapshot internally consistent even if another buyer
          // drained a batch between the quote and this transaction.
          const rule = await this.pricing.resolveActiveRule(
            user,
            line.productId,
          );
          const priced = this.pricing.buildLineFromAllocations(
            line.productId,
            line.quantity,
            allocations,
            rule,
          );
          committed.push({
            productId: priced.productId,
            quantity: priced.quantity,
            allocations: priced.batches.map((b) => ({
              batchId: b.batchId,
              batchNumber: b.batchNumber,
              quantity: b.quantity,
              unitPrice: b.unitPrice,
              lineTotal: b.lineTotal,
            })),
            blendedUnitPrice: priced.unitPrice,
            lineTotal: priced.lineTotal,
            pricingSnapshot: priced.pricingSnapshot,
          });
          committedSubtotal = committedSubtotal.add(priced.lineTotal);
        }

        const committedDeliveryFee = this.pricing.deliveryFee(
          dto.deliveryType,
          committedSubtotal,
        );
        const committedTotal = committedSubtotal.add(committedDeliveryFee);
        const committedPaymentSummary = this.payments.paymentSummaryForCreate(
          committedTotal,
          dto.paymentOption === CheckoutPaymentOption.PARTIAL_UPI,
        );

        const order = await tx.order.create({
          data: {
            userId: user.id,
            status: OrderStatus.PLACED,
            deliveryType: dto.deliveryType,
            deliveryFee: committedDeliveryFee,
            subtotalAmount: committedSubtotal,
            totalAmount: committedTotal,
            addressSnapshot,
            paymentMode: committedPaymentSummary.paymentMode,
            paymentStatus: PaymentStatus.PENDING,
            paidAmount: 0,
            dueAmount: committedPaymentSummary.dueAmount,
            paymentCollectionRequired:
              committedPaymentSummary.paymentCollectionRequired,
            collectionStatus: committedPaymentSummary.collectionStatus,
            collectionInstructions:
              committedPaymentSummary.collectionInstructions,
            items: {
              create: committed.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                priceApplied: l.blendedUnitPrice,
                pricingSnapshot: l.pricingSnapshot,
              })),
            },
          },
          include: { items: true },
        });

        for (const item of order.items) {
          const match = committed.find((l) => l.productId === item.productId);
          if (!match) continue;
          for (const allocation of match.allocations) {
            await tx.orderItemBatchAllocation.create({
              data: {
                orderItemId: item.id,
                batchId: allocation.batchId,
                quantity: allocation.quantity,
                unitPrice: allocation.unitPrice,
              },
            });
          }
        }
        return order;
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
      deliveryType: o.deliveryType,
      deliveryFee: o.deliveryFee.toString(),
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
        items: {
          include: {
            product: { select: { name: true } },
            batchAllocations: {
              orderBy: { createdAt: 'asc' },
              include: {
                batch: {
                  select: { batchNumber: true, sellingPrice: true },
                },
              },
            },
          },
        },
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
      include: { items: { include: { batchAllocations: true } } },
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
          await this.inventory.restoreInTransaction(
            tx,
            item.batchAllocations.map((a) => ({
              batchId: a.batchId,
              quantity: a.quantity,
            })),
          );
        }
      }
      // On delivery the batch quantity stays decremented — the goods have left
      // the warehouse, no further inventory adjustment needed.

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
        include: { items: { include: { batchAllocations: true } } },
      });
      if (
        !order ||
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.DELIVERED
      ) {
        return;
      }
      for (const item of order.items) {
        await this.inventory.restoreInTransaction(
          tx,
          item.batchAllocations.map((a) => ({
            batchId: a.batchId,
            quantity: a.quantity,
          })),
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
