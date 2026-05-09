"use client";

import type { OrderListPeriod } from "@application/ports/order-reader";
import type { Order, OrderStatus } from "@domain/order";
import type { Product } from "@domain/product";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Chip } from "@presentation/components/ui/chip";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import {
  IconBox,
  IconCalendar,
  IconChartLine,
  IconChevronDown,
  IconEllipsisVertical,
  IconInvoice,
  IconPlus,
  IconReorder,
  IconSearch,
} from "@presentation/features/order-history/order-history-icons";
import {
  filterOrdersByTimeRange,
  previousWindowTotals,
  spendTrendPercent,
  type TimeRange,
} from "@presentation/features/order-history/order-history-utils";
import { ORDER_HISTORY_DUMMY_ORDERS } from "@infrastructure/mock/order-history-dummy-orders";
import { DownloadOrderInvoiceButton } from "@presentation/components/order/download-order-invoice-button";
import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 5;

type StatusFilter = "all" | "delivered" | "in_progress";
type FilterDropdown = "summaryRange" | "range" | "status" | null;

const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: "thisMonth", label: "This month" },
  { value: "last3Months", label: "Last 3 months" },
  { value: "all", label: "All time" },
];

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "in_progress", label: "Processing" },
];

function isProcessingStatus(status: OrderStatus): boolean {
  return status !== "delivered";
}

function statusLabel(status: OrderStatus): string {
  return status === "delivered" ? "Delivered" : "Processing";
}

function lineItemCount(order: Order): number {
  return order.lines.reduce((s, l) => s + l.quantity, 0);
}

function timeRangeLabel(r: TimeRange): string {
  if (r === "thisMonth") return "This month";
  if (r === "last3Months") return "Last 3 months";
  return "All time";
}

function orderListPeriodFromTimeRange(range: TimeRange): OrderListPeriod {
  if (range === "last3Months") return "last_3_months";
  if (range === "all") return "all_time";
  return "this_month";
}

function OrderHistoryHeader() {
  return (
    <MobilePageHeader
      title="Order History"
      fallbackHref="/"
      rightAction={
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
          aria-label="More options"
        >
          <IconEllipsisVertical className="h-5 w-5" />
        </button>
      }
    />
  );
}

export function OrderHistoryScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const isQueryEnabled = Boolean(userId);
  const { data: catalog } = useProductsQuery();
  const addProduct = useCartStore((s) => s.addProduct);
  const [timeRange, setTimeRange] = useState<TimeRange>("thisMonth");
  const orderPeriod = orderListPeriodFromTimeRange(timeRange);
  const { data, isPending, isError, refetch } = useOrdersQuery(
    userId,
    orderPeriod,
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openDropdown, setOpenDropdown] = useState<FilterDropdown>(null);

  const orders = useMemo(() => {
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) {
      if (!isQueryEnabled) return ORDER_HISTORY_DUMMY_ORDERS;
      if (isPending) return [];
      const api = data ?? [];
      if (api.length > 0) return api;
      return ORDER_HISTORY_DUMMY_ORDERS;
    }
    return isQueryEnabled ? (data ?? []) : [];
  }, [isQueryEnabled, isPending, data]);

  const usingDummyOrders =
    process.env.NODE_ENV === "development" &&
    (!isQueryEnabled ||
      (!isPending && !isError && isQueryEnabled && (data?.length ?? 0) === 0));

  const timeFiltered = useMemo(
    () => filterOrdersByTimeRange(orders, timeRange),
    [orders, timeRange],
  );

  const spendTotals = useMemo(() => {
    const totalSpend = timeFiltered.reduce((s, o) => s + o.totalCents, 0);
    const count = timeFiltered.length;
    const avg = count > 0 ? Math.round(totalSpend / count) : 0;
    return { totalSpend, count, avg };
  }, [timeFiltered]);

  const trend = useMemo(() => {
    const pair = previousWindowTotals(orders, timeRange);
    if (!pair) return null;
    const pct = spendTrendPercent(pair.current, pair.previous);
    return pct;
  }, [orders, timeRange]);

  const listFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timeFiltered
      .filter((o) => {
        if (statusFilter === "delivered") return o.status === "delivered";
        if (statusFilter === "in_progress") return isProcessingStatus(o.status);
        return true;
      })
      .filter((o) => {
        if (!q) return true;
        const hay =
          `${o.id} ${o.lines.map((l) => l.title).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [timeFiltered, search, statusFilter]);

  const visibleOrders = useMemo(
    () => listFiltered.slice(0, visibleCount),
    [listFiltered, visibleCount],
  );

  const frequentProducts = useMemo(() => {
    if (!catalog?.length || orders.length === 0) return [];
    const freq = new Map<string, number>();
    for (const o of orders) {
      for (const line of o.lines) {
        freq.set(
          line.productId,
          (freq.get(line.productId) ?? 0) + line.quantity,
        );
      }
    }
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    const out: Product[] = [];
    for (const [id] of ranked) {
      const p = catalog.find((x) => x.id === id);
      if (p) out.push(p);
      if (out.length >= 6) break;
    }
    return out;
  }, [catalog, orders]);

  if (process.env.NODE_ENV === "production" && !isAuthenticated) {
    return null;
  }

  if (isQueryEnabled && isPending) {
    return (
      <div className="space-y-3">
        <OrderHistoryHeader />
        <div className="h-10 w-full animate-pulse rounded-lg bg-secondary-bg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={String(i)}
            className="h-28 animate-pulse rounded-xl bg-secondary-bg"
          />
        ))}
      </div>
    );
  }

  if (isQueryEnabled && isError) {
    return (
      <div className="flex flex-col gap-4">
        <OrderHistoryHeader />
        <Card>
          <p className="text-secondary">Could not load orders.</p>
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-primary"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <OrderHistoryHeader />
        <Card>
          <p className="text-secondary">No orders yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            Start shopping
          </Link>
        </Card>
      </div>
    );
  }

  const canLoadMore = visibleCount < listFiltered.length;

  return (
    <div className="flex flex-col gap-0">
      <OrderHistoryHeader />

      {usingDummyOrders ? (
        <div className="mx-4 mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-heading sm:mx-0">
          Sample orders (development only). Sign in to load your real order
          history.
        </div>
      ) : null}

      <section className="mt-2 border-b border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-heading">Spend summary</h2>
          <div className="relative">
            <button
              type="button"
              aria-expanded={openDropdown === "summaryRange"}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/15 bg-primary-light/60 px-2.5 text-[10px] font-bold text-primary transition-colors hover:bg-primary-light"
              onClick={() =>
                setOpenDropdown((open) =>
                  open === "summaryRange" ? null : "summaryRange",
                )
              }
            >
              {timeRangeLabel(timeRange)}
              <IconChevronDown className="h-3 w-3" />
            </button>
            {openDropdown === "summaryRange" ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-36 overflow-hidden rounded-xl border border-default bg-card p-1 shadow-lg">
                {timeRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[11px] font-bold transition-colors",
                      timeRange === option.value
                        ? "bg-primary-light text-primary"
                        : "text-heading hover:bg-secondary-bg",
                    )}
                    onClick={() => {
                      setTimeRange(option.value);
                      setVisibleCount(PAGE_SIZE);
                      setOpenDropdown(null);
                    }}
                  >
                    {option.label}
                    {timeRange === option.value ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-primary/15 bg-primary-light/30 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted">
              <IconChartLine />
              <span className="text-[10px] font-medium">Total spend</span>
            </div>
            <p className="text-lg font-bold text-heading">
              {formatMoney(spendTotals.totalSpend)}
            </p>
            {trend != null ? (
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-[10px] font-semibold",
                  trend >= 0 ? "text-primary" : "text-secondary",
                )}
              >
                {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% vs prev.
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-muted">—</p>
            )}
          </div>
          <div className="rounded-xl border border-default/60 bg-secondary-bg p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted">
              <IconBox />
              <span className="text-[10px] font-medium">Total orders</span>
            </div>
            <p className="text-lg font-bold text-heading">
              {spendTotals.count}
            </p>
            <p className="mt-1 text-[10px] text-muted">
              Avg {spendTotals.count > 0 ? formatMoney(spendTotals.avg) : "—"}
              /order
            </p>
          </div>
        </div>
      </section>

      {frequentProducts.length > 0 ? (
        <section className="mt-2 border-b border-default/60 bg-page py-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-heading">
              Frequently reordered
            </h2>
            <Link href="/" className="text-[10px] font-semibold text-primary">
              View all
            </Link>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1">
            {frequentProducts.map((p) => (
              <div
                key={p.id}
                className="flex min-w-[120px] max-w-[120px] flex-col rounded-xl border border-default/60 bg-card p-2 shadow-sm"
              >
                <div className="mb-2 flex h-20 w-full items-center justify-center overflow-hidden rounded-lg bg-input-bg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="mb-1 line-clamp-2 text-[10px] font-semibold leading-tight text-heading">
                  {p.title}
                </p>
                <p className="mb-2 text-[10px] text-muted">
                  {formatMoney(p.priceCents, p.currency)}/case
                </p>
                <button
                  type="button"
                  className="mt-auto flex w-full items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-[10px] font-semibold text-white hover:bg-primary-dark"
                  onClick={() => addProduct(p, 1)}
                >
                  <IconPlus className="h-3 w-3" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="z-10 mt-2 space-y-3 border-b border-default/60 bg-card p-4 shadow-sm sm:rounded-xl sm:border sm:border-default/60">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <IconSearch />
          </span>
          <input
            type="search"
            placeholder="Search order ID, item, or brand…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            onFocus={() => setOpenDropdown(null)}
            className="min-h-11 w-full rounded-xl border border-default/70 bg-input-bg py-2.5 pl-10 pr-3 text-xs font-medium text-heading outline-none transition-[border-color,box-shadow,background-color] placeholder:text-input-placeholder focus:border-primary/30 focus:bg-card focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <Chip
              type="button"
              active
              aria-expanded={openDropdown === "range"}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold shadow-sm"
              onClick={() =>
                setOpenDropdown((open) => (open === "range" ? null : "range"))
              }
            >
              <IconCalendar />
              <span className="truncate">{timeRangeLabel(timeRange)}</span>
              <IconChevronDown className="h-3 w-3" />
            </Chip>
            {openDropdown === "range" ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-default bg-card p-1 shadow-lg">
                {timeRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[11px] font-bold transition-colors",
                      timeRange === option.value
                        ? "bg-primary-light text-primary"
                        : "text-heading hover:bg-secondary-bg",
                    )}
                    onClick={() => {
                      setTimeRange(option.value);
                      setVisibleCount(PAGE_SIZE);
                      setOpenDropdown(null);
                    }}
                  >
                    {option.label}
                    {timeRange === option.value ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <Chip
              type="button"
              active
              aria-expanded={openDropdown === "status"}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-bold shadow-sm"
              onClick={() =>
                setOpenDropdown((open) => (open === "status" ? null : "status"))
              }
            >
              <span className="truncate">
                Status:{" "}
                {statusFilterOptions.find(
                  (option) => option.value === statusFilter,
                )?.label ?? "All"}
              </span>
              <IconChevronDown className="h-3 w-3" />
            </Chip>
            {openDropdown === "status" ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-default bg-card p-1 shadow-lg">
                {statusFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between rounded-lg px-3 text-left text-[11px] font-bold transition-colors",
                      statusFilter === option.value
                        ? "bg-primary-light text-primary"
                        : "text-heading hover:bg-secondary-bg",
                    )}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setVisibleCount(PAGE_SIZE);
                      setOpenDropdown(null);
                    }}
                  >
                    {option.label}
                    {statusFilter === option.value ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-2 space-y-3 pb-4">
        {listFiltered.length === 0 ? (
          <Card>
            <p className="text-sm text-secondary">
              No orders match your filters.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setTimeRange("thisMonth");
                setVisibleCount(PAGE_SIZE);
                setOpenDropdown(null);
              }}
            >
              Clear filters
            </button>
          </Card>
        ) : (
          <>
            {visibleOrders.map((order) => (
              <OrderHistoryCard
                key={order.id}
                order={order}
                onReorderAll={() => {
                  if (!catalog) return;
                  for (const line of order.lines) {
                    const p = catalog.find((x) => x.id === line.productId);
                    if (p) addProduct(p, line.quantity);
                  }
                }}
              />
            ))}
            {canLoadMore ? (
              <div className="flex justify-center py-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full px-5 text-xs"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                >
                  Load more orders
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function OrderHistoryCard({
  order,
  onReorderAll,
}: {
  order: Order;
  onReorderAll: () => void;
}) {
  const items = lineItemCount(order);
  const lines = order.lines;
  const preview = lines.slice(0, 2);
  const extra = Math.max(0, lines.length - 2);
  const titles = lines.map((l) => l.title).join(", ");

  const reorderEnabled = order.status === "delivered";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-default/60 bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-default/50 pb-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-heading">#{order.id}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                order.status === "delivered"
                  ? "border-default bg-chip-inactive text-chip-inactive-text"
                  : "border-primary/25 bg-primary-light text-primary",
              )}
            >
              {statusLabel(order.status)}
            </span>
          </div>
          <p className="text-[10px] text-muted">
            {new Date(order.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {items} items
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-heading">
            {formatMoney(order.totalCents)}
          </p>
          {order.status === "delivered" ? (
            <Link
              href={`/orders/${order.id}/confirmation`}
              className="mt-1 inline-block text-[10px] font-semibold text-primary"
            >
              View details
            </Link>
          ) : (
            <Link
              href={`/orders/${order.id}/track`}
              className="mt-1 inline-block text-[10px] font-semibold text-primary"
            >
              Track order
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {preview.map((line) => (
            <div
              key={line.productId}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-input-bg text-[8px] font-bold text-heading"
            >
              {line.title.trim().charAt(0).toUpperCase()}
            </div>
          ))}
          {extra > 0 ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-card bg-input-bg text-[8px] font-bold text-heading">
              +{extra}
            </div>
          ) : null}
        </div>
        <p className="line-clamp-1 flex-1 text-[10px] text-muted">{titles}</p>
      </div>

      <div className="flex gap-2 pt-1">
        <DownloadOrderInvoiceButton
          order={order}
          rootClassName="min-w-0 flex-1"
          className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-default bg-secondary-bg py-2 text-[10px] font-semibold text-heading hover:bg-input-bg"
        >
          <IconInvoice />
          Invoice
        </DownloadOrderInvoiceButton>
        <button
          type="button"
          disabled={!reorderEnabled}
          onClick={onReorderAll}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-semibold text-white",
            reorderEnabled
              ? "bg-primary hover:bg-primary-dark"
              : "cursor-not-allowed bg-primary/50 opacity-60",
          )}
        >
          <IconReorder />
          Reorder all
        </button>
      </div>
    </div>
  );
}
