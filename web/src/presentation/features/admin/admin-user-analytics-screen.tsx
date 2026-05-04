"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@presentation/lib/cn";
import { formatDateTime, formatInr, statusLabel } from "./admin-format";
import {
  getAdminUserAnalytics,
  type AdminAnalyticsRange,
} from "./admin-api";
import { useAdminQuery } from "./use-admin-query";

const rangeOptions: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatCount(value: number | string): string {
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-catalog-text">{value}</p>
      <p className="mt-1 text-xs text-catalog-text-muted">{hint}</p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-catalog-green-border bg-catalog-green-muted p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-catalog-green">
        {title}
      </p>
      <p className="mt-2 text-lg font-bold text-catalog-text">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-catalog-text-muted">
        {detail}
      </p>
    </div>
  );
}

function ChartPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold text-catalog-text">{title}</h2>
      <div className="mt-4 h-64">{children}</div>
    </section>
  );
}

export function AdminUserAnalyticsScreen() {
  const params = useParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "user-analytics", userId, range],
    () => getAdminUserAnalytics(userId ?? "", range),
  );

  if (!userId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Buyer id is missing.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={String(i)}
            className="h-36 animate-pulse rounded-xl bg-catalog-input"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Could not load buyer analytics."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/users"
            className="text-xs font-bold uppercase tracking-wide text-catalog-green hover:underline"
          >
            All users
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-catalog-text">
            {data.profile.businessName}
          </h1>
          <p className="text-sm text-catalog-text-muted">
            {data.profile.phone}
            {data.profile.email ? ` / ${data.profile.email}` : ""} /{" "}
            {data.profile.location.location}
          </p>
        </div>
        <div className="flex rounded-lg border border-catalog-border bg-card p-1">
          {rangeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "min-h-9 rounded-md px-3 text-xs font-bold transition-colors",
                range === option.value
                  ? "bg-catalog-green text-white"
                  : "text-catalog-text-muted hover:bg-catalog-input hover:text-catalog-text",
              )}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatInr(data.totals.revenue)}
          hint="Completed order value"
        />
        <MetricCard
          label="Orders"
          value={formatCount(data.totals.orders)}
          hint={`${formatCount(data.totals.completedOrders)} completed`}
        />
        <MetricCard
          label="Average order"
          value={formatInr(data.totals.averageOrderValue)}
          hint="Based on completed orders"
        />
        <MetricCard
          label="Items bought"
          value={formatCount(data.totals.itemsBought)}
          hint={
            data.totals.lastOrderAt
              ? `Last order ${formatDateTime(data.totals.lastOrderAt)}`
              : "No orders yet"
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.insights.map((insight) => (
          <InsightCard
            key={insight.title}
            title={insight.title}
            value={insight.value}
            detail={insight.detail}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Purchase timeline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.purchaseTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatInr(Number(value))} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#0f5132"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Category breakdown">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatInr(Number(value))} />
              <Bar dataKey="revenue" fill="#052c65" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Products bought">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {data.productsBought.length ? (
                  data.productsBought.map((product) => (
                    <tr key={product.productId}>
                      <td className="py-2">
                        <p className="font-semibold text-catalog-text">
                          {product.name}
                        </p>
                        <p className="text-xs text-catalog-text-muted">
                          {product.category}
                        </p>
                      </td>
                      <td className="py-2">{product.quantity}</td>
                      <td className="py-2">{formatInr(product.revenue)}</td>
                      <td className="py-2 text-xs text-catalog-text-muted">
                        {formatDateTime(product.lastPurchasedAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-catalog-text-muted" colSpan={4}>
                      No products bought in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartPanel>

        <ChartPanel title="Recent orders">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {data.recentOrders.length ? (
                  data.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="py-2 font-mono text-xs text-catalog-text">
                        {order.id.slice(0, 8)}
                      </td>
                      <td className="py-2">{statusLabel(order.status)}</td>
                      <td className="py-2">{formatInr(order.totalAmount)}</td>
                      <td className="py-2 text-xs text-catalog-text-muted">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-catalog-text-muted" colSpan={4}>
                      No recent orders in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}
