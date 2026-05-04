import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminAnalyticsRange } from './dto/query-admin-analytics.dto';

const LOW_STOCK_THRESHOLD = 20;
const DEFAULT_RANGE: AdminAnalyticsRange = '30d';
const RANGE_DAYS: Record<Exclude<AdminAnalyticsRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

type LocationBucket = {
  city: string;
  state: string;
  location: string;
};

type InsightCard = {
  title: string;
  value: string;
  detail: string;
};

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function utcDayStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function dayKey(date: Date): string {
  return utcDayStart(date).toISOString().slice(0, 10);
}

function normalizeRange(range?: AdminAnalyticsRange): AdminAnalyticsRange {
  return range ?? DEFAULT_RANGE;
}

function rangeStart(range: AdminAnalyticsRange): Date | undefined {
  if (range === 'all') {
    return undefined;
  }
  const start = utcDayStart(new Date());
  start.setUTCDate(start.getUTCDate() - (RANGE_DAYS[range] - 1));
  return start;
}

function createdAtFilter(range: AdminAnalyticsRange): Prisma.OrderWhereInput {
  const start = rangeStart(range);
  return start ? { createdAt: { gte: start } } : {};
}

function buildDayRows<T>(
  range: AdminAnalyticsRange,
  dates: Date[],
  factory: (date: string) => T,
): Map<string, T> {
  const explicitStart = rangeStart(range);
  const fallbackStart = new Date();
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 29);

  const start = utcDayStart(
    explicitStart ??
      dates.reduce<Date | undefined>(
        (earliest, date) =>
          !earliest || date.getTime() < earliest.getTime() ? date : earliest,
        undefined,
      ) ??
      fallbackStart,
  );
  const end = utcDayStart(new Date());
  const rows = new Map<string, T>();

  for (
    const day = new Date(start);
    day <= end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = dayKey(day);
    rows.set(key, factory(key));
  }

  return rows;
}

function recordFromJson(
  value: Prisma.JsonValue | null | undefined,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value;
}

function cleanLocationPart(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function makeLocation(city: string, state: string): LocationBucket | null {
  if (!city && !state) {
    return null;
  }
  const location = city && state ? `${city}, ${state}` : city || state;
  return {
    city: city || 'Unknown',
    state: state || 'Unknown',
    location,
  };
}

function locationFromAddressSnapshot(
  snapshot: Prisma.JsonValue | null | undefined,
): LocationBucket | null {
  const record = recordFromJson(snapshot);
  if (!record) {
    return null;
  }
  return makeLocation(
    cleanLocationPart(record.city),
    cleanLocationPart(record.state),
  );
}

function locationFromAddress(address?: {
  city: string;
  state: string;
}): LocationBucket | null {
  if (!address) {
    return null;
  }
  return makeLocation(address.city.trim(), address.state.trim());
}

function unknownLocation(): LocationBucket {
  return { city: 'Unknown', state: 'Unknown', location: 'Unknown' };
}

function card(title: string, value: string, detail: string): InsightCard {
  return { title, value, detail };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: { role?: UserRole; page: number; pageSize: number }) {
    const where: Prisma.UserWhereInput = {};
    if (params.role) {
      where.role = params.role;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          email: true,
          name: true,
          businessName: true,
          businessType: true,
          gstNumber: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { orders: true, addresses: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async analytics(inputRange?: AdminAnalyticsRange) {
    const range = normalizeRange(inputRange);
    const orderWhere = createdAtFilter(range);
    const commercialOrderWhere: Prisma.OrderWhereInput = {
      ...orderWhere,
      status: { not: OrderStatus.CANCELLED },
    };

    const [
      totalBuyers,
      totalProducts,
      periodOrders,
      firstOrderGroups,
      orderItemRows,
      lowStock,
      buyers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.BUYER } }),
      this.prisma.product.count(),
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          userId: true,
          status: true,
          createdAt: true,
          totalAmount: true,
          addressSnapshot: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { status: { not: OrderStatus.CANCELLED } },
        _min: { createdAt: true },
      }),
      this.prisma.orderItem.findMany({
        where: { order: commercialOrderWhere },
        select: {
          orderId: true,
          productId: true,
          quantity: true,
          priceApplied: true,
          order: { select: { userId: true, createdAt: true } },
          product: { select: { name: true, category: true } },
        },
      }),
      this.prisma.inventory.findMany({
        where: { availableQty: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { availableQty: 'asc' },
        take: 10,
        include: { product: true },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.BUYER },
        select: {
          id: true,
          phone: true,
          email: true,
          businessName: true,
          addresses: {
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
            take: 1,
            select: { city: true, state: true },
          },
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { addressSnapshot: true },
          },
        },
      }),
    ]);

    const buyersById = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    const buyerLocations = new Map<string, LocationBucket>();
    const locationStats = new Map<
      string,
      LocationBucket & {
        buyers: number;
        orders: number;
        revenue: number;
        firstHalfOrders: number;
        secondHalfOrders: number;
      }
    >();

    const trendDates = periodOrders.map((order) => order.createdAt);
    const revenueByDay = buildDayRows(range, trendDates, (date) => ({
      date,
      revenue: 0,
      orders: 0,
    }));
    const repeatByDay = buildDayRows(range, trendDates, (date) => ({
      date,
      newBuyers: 0,
      repeatBuyers: 0,
    }));
    const repeatSets = new Map<
      string,
      { newBuyers: Set<string>; repeatBuyers: Set<string> }
    >();
    for (const key of repeatByDay.keys()) {
      repeatSets.set(key, { newBuyers: new Set(), repeatBuyers: new Set() });
    }

    const firstOrderByUser = new Map(
      firstOrderGroups.map((row) => [row.userId, row._min.createdAt]),
    );
    const dayKeys = [...revenueByDay.keys()];
    const firstDay = dayKeys[0]
      ? new Date(`${dayKeys[0]}T00:00:00.000Z`)
      : new Date();
    const lastDay = dayKeys.at(-1)
      ? new Date(`${dayKeys.at(-1)}T23:59:59.999Z`)
      : new Date();
    const midpoint =
      firstDay.getTime() + (lastDay.getTime() - firstDay.getTime()) / 2;

    for (const buyer of buyers) {
      const location =
        locationFromAddressSnapshot(buyer.orders[0]?.addressSnapshot) ??
        locationFromAddress(buyer.addresses[0]) ??
        unknownLocation();
      buyerLocations.set(buyer.id, location);
      const current = locationStats.get(location.location) ?? {
        ...location,
        buyers: 0,
        orders: 0,
        revenue: 0,
        firstHalfOrders: 0,
        secondHalfOrders: 0,
      };
      current.buyers += 1;
      locationStats.set(location.location, current);
    }

    const buyerOrderStats = new Map<
      string,
      {
        userId: string;
        businessName: string;
        phone: string;
        email: string | null;
        orders: number;
        revenue: number;
        lastOrderAt: Date | null;
      }
    >();
    const activeBuyerIds = new Set<string>();

    for (const order of periodOrders) {
      const isCommercial = order.status !== OrderStatus.CANCELLED;
      const orderDay = dayKey(order.createdAt);
      const location = buyerLocations.get(order.userId) ?? unknownLocation();
      const locationStat = locationStats.get(location.location) ?? {
        ...location,
        buyers: 0,
        orders: 0,
        revenue: 0,
        firstHalfOrders: 0,
        secondHalfOrders: 0,
      };
      locationStat.orders += 1;
      if (order.createdAt.getTime() >= midpoint) {
        locationStat.secondHalfOrders += 1;
      } else {
        locationStat.firstHalfOrders += 1;
      }
      if (isCommercial) {
        const revenue = decimalToNumber(order.totalAmount);
        activeBuyerIds.add(order.userId);
        locationStat.revenue += revenue;
        const revenueRow = revenueByDay.get(orderDay);
        if (revenueRow) {
          revenueRow.revenue += revenue;
          revenueRow.orders += 1;
        }

        const buyer = buyersById.get(order.userId);
        const buyerStat = buyerOrderStats.get(order.userId) ?? {
          userId: order.userId,
          businessName: buyer?.businessName ?? 'Unknown buyer',
          phone: buyer?.phone ?? '',
          email: buyer?.email ?? null,
          orders: 0,
          revenue: 0,
          lastOrderAt: null,
        };
        buyerStat.orders += 1;
        buyerStat.revenue += revenue;
        if (
          !buyerStat.lastOrderAt ||
          order.createdAt.getTime() > buyerStat.lastOrderAt.getTime()
        ) {
          buyerStat.lastOrderAt = order.createdAt;
        }
        buyerOrderStats.set(order.userId, buyerStat);

        const firstOrder = firstOrderByUser.get(order.userId);
        const sets = repeatSets.get(orderDay);
        if (sets) {
          if (firstOrder && dayKey(firstOrder) === orderDay) {
            sets.newBuyers.add(order.userId);
          } else {
            sets.repeatBuyers.add(order.userId);
          }
        }
      }
      locationStats.set(location.location, locationStat);
    }

    for (const [date, sets] of repeatSets) {
      const row = repeatByDay.get(date);
      if (row) {
        row.newBuyers = sets.newBuyers.size;
        row.repeatBuyers = sets.repeatBuyers.size;
      }
    }

    const topProductMap = new Map<
      string,
      {
        productId: string;
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        orderIds: Set<string>;
      }
    >();
    const categoryMap = new Map<
      string,
      { category: string; quantity: number; revenue: number }
    >();

    for (const row of orderItemRows) {
      const revenue = decimalToNumber(row.priceApplied) * row.quantity;
      const current = topProductMap.get(row.productId) ?? {
        productId: row.productId,
        name: row.product.name,
        category: row.product.category,
        quantity: 0,
        revenue: 0,
        orderIds: new Set<string>(),
      };
      current.quantity += row.quantity;
      current.revenue += revenue;
      current.orderIds.add(row.orderId);
      topProductMap.set(row.productId, current);

      const category = categoryMap.get(row.product.category) ?? {
        category: row.product.category,
        quantity: 0,
        revenue: 0,
      };
      category.quantity += row.quantity;
      category.revenue += revenue;
      categoryMap.set(row.product.category, category);
    }

    const topBuyers = [...buyerOrderStats.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
      .map((buyer) => ({
        ...buyer,
        lastOrderAt: buyer.lastOrderAt?.toISOString() ?? null,
      }));
    const topProducts = [...topProductMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8)
      .map((product) => ({
        productId: product.productId,
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        revenue: product.revenue,
      }));
    const topCategories = [...categoryMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    const buyersByLocation = [...locationStats.values()]
      .sort((a, b) => b.buyers - a.buyers)
      .slice(0, 10)
      .map((location) => ({
        city: location.city,
        state: location.state,
        location: location.location,
        buyers: location.buyers,
        orders: location.orders,
        revenue: location.revenue,
      }));
    const mostReorderedProduct = [...topProductMap.values()].sort(
      (a, b) => b.orderIds.size - a.orderIds.size,
    )[0];
    const fastestGrowingLocation = [...locationStats.values()].sort(
      (a, b) =>
        b.secondHalfOrders -
        b.firstHalfOrders -
        (a.secondHalfOrders - a.firstHalfOrders),
    )[0];
    const revenue = [...buyerOrderStats.values()].reduce(
      (sum, buyer) => sum + buyer.revenue,
      0,
    );
    const commercialOrders = periodOrders.filter(
      (order) => order.status !== OrderStatus.CANCELLED,
    ).length;

    return {
      range,
      totals: {
        revenue,
        orders: periodOrders.length,
        buyers: totalBuyers,
        activeBuyers: activeBuyerIds.size,
        inactiveBuyers: Math.max(totalBuyers - activeBuyerIds.size, 0),
        products: totalProducts,
        averageOrderValue: commercialOrders ? revenue / commercialOrders : 0,
      },
      insights: [
        topBuyers[0]
          ? card(
              'Highest value buyer',
              topBuyers[0].businessName,
              `${topBuyers[0].orders} orders worth ${topBuyers[0].revenue.toFixed(0)} in this range.`,
            )
          : card(
              'Highest value buyer',
              'No orders yet',
              'Revenue will appear after buyers place orders.',
            ),
        fastestGrowingLocation
          ? card(
              'Fastest growing location',
              fastestGrowingLocation.location,
              `${Math.max(
                fastestGrowingLocation.secondHalfOrders -
                  fastestGrowingLocation.firstHalfOrders,
                0,
              )} more orders in the second half of this range.`,
            )
          : card(
              'Fastest growing location',
              'No location data',
              'Add addresses or orders to unlock geography insights.',
            ),
        mostReorderedProduct
          ? card(
              'Most reordered product',
              mostReorderedProduct.name,
              `Appeared in ${mostReorderedProduct.orderIds.size} orders and ${mostReorderedProduct.quantity} units.`,
            )
          : card(
              'Most reordered product',
              'No product orders',
              'Product insights will build as orders come in.',
            ),
        card(
          'Inactive buyers',
          String(Math.max(totalBuyers - activeBuyerIds.size, 0)),
          'Registered buyers without a completed purchase in the selected range.',
        ),
      ],
      ordersByStatus: Object.values(OrderStatus).map((status) => ({
        status,
        count: periodOrders.filter((order) => order.status === status).length,
      })),
      revenueTrend: [...revenueByDay.values()],
      repeatBuyerTrend: [...repeatByDay.values()],
      buyersByLocation,
      topBuyers,
      topProducts,
      topCategories,
      lowStock: lowStock.map((row) => ({
        productId: row.productId,
        name: row.product.name,
        category: row.product.category,
        availableQty: row.availableQty,
        reservedQty: row.reservedQty,
      })),
    };
  }

  async userAnalytics(userId: string, inputRange?: AdminAnalyticsRange) {
    const range = normalizeRange(inputRange);
    const orderWhere = createdAtFilter(range);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.BUYER },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        businessName: true,
        businessType: true,
        gstNumber: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
          take: 1,
          select: { city: true, state: true },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { addressSnapshot: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Buyer not found');
    }

    const orders = await this.prisma.order.findMany({
      where: { userId, ...orderWhere },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, category: true } },
          },
        },
      },
    });
    const commercialOrders = orders.filter(
      (order) => order.status !== OrderStatus.CANCELLED,
    );
    const timeline = buildDayRows(
      range,
      orders.map((order) => order.createdAt),
      (date) => ({ date, revenue: 0, orders: 0, quantity: 0 }),
    );
    const productMap = new Map<
      string,
      {
        productId: string;
        name: string;
        category: string;
        quantity: number;
        revenue: number;
        orders: number;
        firstPurchasedAt: Date;
        lastPurchasedAt: Date;
      }
    >();
    const categoryMap = new Map<
      string,
      { category: string; quantity: number; revenue: number }
    >();

    for (const order of commercialOrders) {
      const date = dayKey(order.createdAt);
      const timelineRow = timeline.get(date);
      if (timelineRow) {
        timelineRow.orders += 1;
        timelineRow.revenue += decimalToNumber(order.totalAmount);
      }
      for (const item of order.items) {
        const revenue = decimalToNumber(item.priceApplied) * item.quantity;
        if (timelineRow) {
          timelineRow.quantity += item.quantity;
        }
        const product = productMap.get(item.productId) ?? {
          productId: item.productId,
          name: item.product.name,
          category: item.product.category,
          quantity: 0,
          revenue: 0,
          orders: 0,
          firstPurchasedAt: order.createdAt,
          lastPurchasedAt: order.createdAt,
        };
        product.quantity += item.quantity;
        product.revenue += revenue;
        product.orders += 1;
        if (order.createdAt < product.firstPurchasedAt) {
          product.firstPurchasedAt = order.createdAt;
        }
        if (order.createdAt > product.lastPurchasedAt) {
          product.lastPurchasedAt = order.createdAt;
        }
        productMap.set(item.productId, product);

        const category = categoryMap.get(item.product.category) ?? {
          category: item.product.category,
          quantity: 0,
          revenue: 0,
        };
        category.quantity += item.quantity;
        category.revenue += revenue;
        categoryMap.set(item.product.category, category);
      }
    }

    const revenue = commercialOrders.reduce(
      (sum, order) => sum + decimalToNumber(order.totalAmount),
      0,
    );
    const productsBought = [...productMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .map((product) => ({
        ...product,
        firstPurchasedAt: product.firstPurchasedAt.toISOString(),
        lastPurchasedAt: product.lastPurchasedAt.toISOString(),
      }));
    const categoryBreakdown = [...categoryMap.values()].sort(
      (a, b) => b.revenue - a.revenue,
    );
    const topProduct = productsBought[0];
    const topCategory = categoryBreakdown[0];
    const lastOrder = orders.at(-1);
    const location =
      locationFromAddressSnapshot(user.orders[0]?.addressSnapshot) ??
      locationFromAddress(user.addresses[0]) ??
      unknownLocation();

    return {
      range,
      profile: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        businessName: user.businessName,
        businessType: user.businessType,
        gstNumber: user.gstNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        location,
      },
      totals: {
        revenue,
        orders: orders.length,
        completedOrders: commercialOrders.length,
        averageOrderValue: commercialOrders.length
          ? revenue / commercialOrders.length
          : 0,
        itemsBought: productsBought.reduce(
          (sum, product) => sum + product.quantity,
          0,
        ),
        lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
      },
      insights: [
        topProduct
          ? card(
              'Most purchased item',
              topProduct.name,
              `${topProduct.quantity} units across ${topProduct.orders} order lines.`,
            )
          : card(
              'Most purchased item',
              'No purchases',
              'This buyer has no completed purchases in the range.',
            ),
        topCategory
          ? card(
              'Favorite category',
              topCategory.category,
              `${topCategory.quantity} units and ${topCategory.revenue.toFixed(0)} revenue.`,
            )
          : card(
              'Favorite category',
              'No category data',
              'Category insights appear after product purchases.',
            ),
        lastOrder
          ? card(
              'Last activity',
              dayKey(lastOrder.createdAt),
              `Most recent order status is ${lastOrder.status.toLowerCase().replaceAll('_', ' ')}.`,
            )
          : card(
              'Last activity',
              'No orders',
              'No orders found for this selected range.',
            ),
        card(
          'Active purchase days',
          String([...timeline.values()].filter((row) => row.orders > 0).length),
          'Number of days with at least one completed order.',
        ),
      ],
      purchaseTimeline: [...timeline.values()],
      productsBought,
      categoryBreakdown,
      recentOrders: orders
        .slice(-8)
        .reverse()
        .map((order) => ({
          id: order.id,
          status: order.status,
          totalAmount: decimalToNumber(order.totalAmount),
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            quantity: item.quantity,
            revenue: decimalToNumber(item.priceApplied) * item.quantity,
          })),
        })),
    };
  }
}
