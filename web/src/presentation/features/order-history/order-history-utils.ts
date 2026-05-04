import type { Order } from "@domain/order";

export type TimeRange = "thisMonth" | "last3Months" | "all";

const MS_DAY = 86400000;

export function orderInTimeRange(
  createdAtIso: string,
  range: TimeRange,
  now = new Date(),
): boolean {
  const t = new Date(createdAtIso).getTime();
  if (range === "all") return true;
  const nowMs = now.getTime();
  if (range === "last3Months") {
    return t >= nowMs - 90 * MS_DAY;
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return t >= start && t <= nowMs;
}

export function filterOrdersByTimeRange(
  orders: Order[],
  range: TimeRange,
  now = new Date(),
): Order[] {
  return orders.filter((o) => orderInTimeRange(o.createdAt, range, now));
}

function sumTotals(orders: Order[]): number {
  return orders.reduce((s, o) => s + o.totalCents, 0);
}

/** Previous window of equal length (for trend). Returns null if not applicable. */
export function previousWindowTotals(
  orders: Order[],
  range: TimeRange,
  now = new Date(),
): { current: number; previous: number } | null {
  if (range === "all") return null;

  if (range === "last3Months") {
    const endPrev = now.getTime() - 90 * MS_DAY;
    const startPrev = endPrev - 90 * MS_DAY;
    const currentOrders = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= now.getTime() - 90 * MS_DAY;
    });
    const prevOrders = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= startPrev && t < endPrev + MS_DAY;
    });
    if (prevOrders.length === 0 && currentOrders.length === 0) return null;
    return {
      current: sumTotals(currentOrders),
      previous: sumTotals(prevOrders),
    };
  }

  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const endPrevMonth = startThisMonth - 1;
  const currentOrders = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= startThisMonth && t <= now.getTime();
  });
  const prevOrders = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= startPrevMonth && t <= endPrevMonth;
  });
  if (prevOrders.length === 0 && currentOrders.length === 0) return null;
  return {
    current: sumTotals(currentOrders),
    previous: sumTotals(prevOrders),
  };
}

export function spendTrendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
