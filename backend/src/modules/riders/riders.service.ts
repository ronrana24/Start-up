import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, RiderStatus, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { OrderListPeriod } from '../orders/dto/list-orders-query.dto';
import { OrdersService } from '../orders/orders.service';
import { PatchDeliveryStatusDto } from './dto/patch-delivery-status.dto';
import { PatchRiderLocationDto } from './dto/patch-rider-location.dto';
import { PatchRiderStatusDto } from './dto/patch-rider-status.dto';
import { RegisterRiderDeviceDto } from './dto/register-rider-device.dto';

const deliveryOrderInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          category: true,
          unit: true,
          imageUrls: true,
        },
      },
    },
  },
  rider: true,
  user: {
    select: {
      id: true,
      phone: true,
      email: true,
      name: true,
      businessName: true,
      businessType: true,
      gstNumber: true,
      role: true,
    },
  },
} satisfies Prisma.OrderInclude;

const availableOrderStatuses: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
];

const activeOrderTerminalStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

const riderDeliveryStatuses: OrderStatus[] = [
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

const riderHistoryStatuses: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly deliveryEvents: DeliveryEventsService,
  ) {}

  list() {
    return this.prisma.rider.findMany({ orderBy: { name: 'asc' } });
  }

  async me(user: User) {
    return this.riderForUser(user);
  }

  async availableOrders(
    user: User,
    params: { page: number; pageSize: number },
  ) {
    await this.riderForUser(user);
    const where: Prisma.OrderWhereInput = {
      riderId: null,
      status: { in: availableOrderStatuses },
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: [{ deliveryType: 'desc' }, { createdAt: 'asc' }],
        include: deliveryOrderInclude,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async activeOrder(user: User) {
    const rider = await this.riderForUser(user);
    return this.activeOrderForRiderId(rider.id);
  }

  async orderHistory(
    user: User,
    params: { period?: OrderListPeriod; page: number; pageSize: number },
  ) {
    const rider = await this.riderForUser(user);
    const period = params.period ?? OrderListPeriod.THIS_MONTH;
    const lowerBound = this.historyLowerBound(period);
    const where: Prisma.OrderWhereInput = {
      riderId: rider.id,
      status: { in: riderHistoryStatuses },
      ...(lowerBound ? { updatedAt: { gte: lowerBound } } : {}),
    };
    const skip = (params.page - 1) * params.pageSize;

    const [items, total, deliveredCount, metricRows] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          deliveryFee: true,
          totalAmount: true,
          addressSnapshot: true,
          pickedUpAt: true,
          deliveredAt: true,
          deliveryDistanceKm: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: { ...where, status: OrderStatus.DELIVERED },
      }),
      this.prisma.order.findMany({
        where,
        select: {
          pickedUpAt: true,
          deliveredAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const durations = metricRows
      .map((order) => this.deliveryDurationSeconds(order))
      .filter((seconds): seconds is number => seconds != null);
    const totalDeliveryTimeSeconds = durations.reduce(
      (sum, seconds) => sum + seconds,
      0,
    );
    const averageDeliveryTimeSeconds = durations.length
      ? Math.round(totalDeliveryTimeSeconds / durations.length)
      : 0;

    return {
      period,
      summary: {
        totalDeliveries: deliveredCount,
        completedOrders: deliveredCount,
        totalDeliveryTimeSeconds,
        averageDeliveryTimeSeconds,
      },
      orders: {
        items: items.map((order) => ({
          id: order.id,
          status: order.status,
          deliveryAddress: this.deliveryAddressLabel(order.addressSnapshot),
          orderAmount: order.totalAmount.toString(),
          earnings: order.deliveryFee.toString(),
          pickedUpAt: order.pickedUpAt?.toISOString() ?? null,
          deliveredAt:
            order.deliveredAt?.toISOString() ??
            (order.status === OrderStatus.DELIVERED
              ? order.updatedAt.toISOString()
              : null),
          completedAt:
            order.deliveredAt?.toISOString() ?? order.updatedAt.toISOString(),
          deliveryDurationSeconds: this.deliveryDurationSeconds(order),
          deliveryDistanceKm: order.deliveryDistanceKm?.toString() ?? null,
          createdAt: order.createdAt.toISOString(),
        })),
        total,
        page: params.page,
        pageSize: params.pageSize,
      },
    };
  }

  async registerDevice(user: User, dto: RegisterRiderDeviceDto) {
    const rider = await this.riderForUser(user);
    return this.prisma.riderDevice.upsert({
      where: { pushToken: dto.pushToken },
      update: {
        riderId: rider.id,
        platform: dto.platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        riderId: rider.id,
        pushToken: dto.pushToken,
        platform: dto.platform,
        isActive: true,
      },
    });
  }

  async claimOrder(user: User, orderId: string) {
    const rider = await this.riderForUser(user);

    await this.prisma.$transaction(
      async (tx) => {
        const activeOrder = await tx.order.findFirst({
          where: {
            riderId: rider.id,
            status: { notIn: activeOrderTerminalStatuses },
          },
          select: { id: true },
        });
        if (activeOrder) {
          throw new ConflictException('Rider already has an active order');
        }

        const existing = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, riderId: true, status: true },
        });
        if (!existing) {
          throw new NotFoundException('Order not found');
        }
        if (existing.riderId) {
          throw new ConflictException('Order already assigned');
        }
        if (!availableOrderStatuses.includes(existing.status)) {
          throw new BadRequestException('Order is not available to claim');
        }

        const claimed = await tx.order.updateMany({
          where: {
            id: orderId,
            riderId: null,
            status: { in: availableOrderStatuses },
          },
          data: {
            riderId: rider.id,
            status: OrderStatus.RIDER_ASSIGNED,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('Order was claimed by another rider');
        }

        await tx.rider.update({
          where: { id: rider.id },
          data: { status: RiderStatus.BUSY },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const order = await this.deliveryOrder(orderId);
    this.deliveryEvents.riderAvailabilityChanged({
      riderId: rider.id,
      available: false,
      reason: 'order_claimed',
    });
    this.deliveryEvents.orderAssigned(order);
    return order;
  }

  async patchDeliveryStatus(
    user: User,
    orderId: string,
    dto: PatchDeliveryStatusDto,
  ) {
    const rider = await this.riderForUser(user);
    if (!riderDeliveryStatuses.includes(dto.status)) {
      throw new BadRequestException('Status is not part of rider workflow');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, riderId: rider.id },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException('Assigned order not found');
    }

    return this.orders.updateStatus(orderId, dto.status);
  }

  async patchMyLocation(user: User, dto: PatchRiderLocationDto) {
    const rider = await this.riderForUser(user);
    const location = { lat: dto.lat, lng: dto.lng, heading: dto.heading };
    const updated = await this.prisma.rider.update({
      where: { id: rider.id },
      data: { currentLocation: location },
    });
    const activeOrder = await this.activeOrderForRiderId(rider.id);
    this.deliveryEvents.riderLocationUpdated({
      riderId: rider.id,
      orderId: activeOrder?.id,
      location,
      order: activeOrder,
    });
    return updated;
  }

  async patchStatus(id: string, dto: PatchRiderStatusDto) {
    const existing = await this.prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rider not found');
    }
    const rider = await this.prisma.rider.update({
      where: { id },
      data: { status: dto.status },
    });
    this.deliveryEvents.riderAvailabilityChanged({
      riderId: id,
      available: dto.status === RiderStatus.IDLE,
      reason: 'rider_status_changed',
    });
    return rider;
  }

  async patchLocation(id: string, dto: PatchRiderLocationDto) {
    const existing = await this.prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rider not found');
    }
    const location = { lat: dto.lat, lng: dto.lng, heading: dto.heading };
    const rider = await this.prisma.rider.update({
      where: { id },
      data: { currentLocation: location },
    });
    const activeOrder = await this.activeOrderForRiderId(id);
    this.deliveryEvents.riderLocationUpdated({
      riderId: id,
      orderId: activeOrder?.id,
      location,
      order: activeOrder,
    });
    return rider;
  }

  private historyLowerBound(period: OrderListPeriod) {
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

  private deliveryDurationSeconds(order: {
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const start = order.pickedUpAt ?? order.createdAt;
    const end = order.deliveredAt ?? order.updatedAt;
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
    return seconds > 0 ? seconds : null;
  }

  private deliveryAddressLabel(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 'Delivery address';
    }
    const object = value as Record<string, unknown>;
    const line1 = this.stringValue(object.line1);
    const line2 = this.stringValue(object.line2);
    const city = this.stringValue(object.city);
    const state = this.stringValue(object.state);
    const pincode = this.stringValue(object.pincode);
    const tail = [city, state, pincode].filter(Boolean).join(', ');
    return (
      [line1, line2, tail].filter(Boolean).join(' - ') || 'Delivery address'
    );
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private async riderForUser(user: User) {
    const rider = await this.prisma.rider.findUnique({
      where: { userId: user.id },
    });
    if (!rider) {
      throw new NotFoundException('Rider not found for current user');
    }
    return rider;
  }

  private activeOrderForRiderId(riderId: string) {
    return this.prisma.order.findFirst({
      where: {
        riderId,
        status: { notIn: activeOrderTerminalStatuses },
      },
      orderBy: { updatedAt: 'desc' },
      include: deliveryOrderInclude,
    });
  }

  private async deliveryOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: deliveryOrderInclude,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
