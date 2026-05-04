"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@presentation/lib/cn";
import { formatDateTime, formatInr, statusLabel } from "./admin-format";
import {
  getAdminAnalytics,
  type AdminAnalyticsRange,
} from "./admin-api";
import { useAdminQuery } from "./use-admin-query";

const chartColors = [
  "#0f5132",
  "#052c65",
  "#1f7a63",
  "#6c757d",
  "#146c43",
  "#94a3b8",
];

const rangeOptions: Array<{ value: AdminAnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function formatCount(value: number | string): string {
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

function rangeLabel(range: AdminAnalyticsRange): string {
  return rangeOptions.find((option) => option.value === range)?.label ?? "30 days";
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

export function AdminDashboardScreen() {
  const [range, setRange] = useState<AdminAnalyticsRange>("30d");
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "analytics", range],
    () => getAdminAnalytics(range),
  );

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
        {error ?? "Could not load analytics."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-catalog-text">Analytics</h1>
          <p className="text-sm text-catalog-text-muted">
            Operational and buyer-level insights for {rangeLabel(data.range)}.
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
          hint="All statuses in range"
        />
        <MetricCard
          label="Active buyers"
          value={formatCount(data.totals.activeBuyers)}
          hint={`${formatCount(data.totals.buyers)} registered buyers`}
        />
        <MetricCard
          label="Average order"
          value={formatInr(data.totals.averageOrderValue)}
          hint={`${formatCount(data.totals.products)} catalog products`}
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
        <ChartPanel title="Revenue trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatInr(Number(value))} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#0f5132"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Repeat vs new buyers">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.repeatBuyerTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="newBuyers"
                name="New buyers"
                stroke="#0f5132"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="repeatBuyers"
                name="Repeat buyers"
                stroke="#052c65"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Buyers by location">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.buyersByLocation}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="location" tick={{ fontSize: 10 }} interval={0} height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatCount(Number(value))} />
              <Bar dataKey="buyers" fill="#0f5132" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Top categories bought">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topCategories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatInr(Number(value))} />
              <Bar dataKey="revenue" fill="#052c65" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Orders by status">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.ordersByStatus}
                dataKey="count"
                nameKey="status"
                innerRadius={58}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.ordersByStatus.map((entry, index) => (
                  <Cell
                    key={entry.status}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === "string"
                    ? statusLabel(label)
                    : String(label ?? "")
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Top products by quantity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dee2e6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#1f7a63" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Top buyers">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="pb-2">Buyer</th>
                  <th className="pb-2">Orders</th>
                  <th className="pb-2">Revenue</th>
                  <th className="pb-2">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {data.topBuyers.length ? (
                  data.topBuyers.map((buyer) => (
                    <tr key={buyer.userId}>
                      <td className="py-2">
                        <Link
                          href={`/admin/users/${buyer.userId}/analytics`}
                          className="font-semibold text-catalog-green hover:underline"
                        >
                          {buyer.businessName}
                        </Link>
                        <p className="text-xs text-catalog-text-muted">
                          {buyer.phone}
                        </p>
                      </td>
                      <td className="py-2">{buyer.orders}</td>
                      <td className="py-2">{formatInr(buyer.revenue)}</td>
                      <td className="py-2 text-xs text-catalog-text-muted">
                        {buyer.lastOrderAt ? formatDateTime(buyer.lastOrderAt) : "None"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-catalog-text-muted" colSpan={4}>
                      No buyer purchases in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartPanel>

        <ChartPanel title="Low-stock inventory">
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Available</th>
                  <th className="pb-2">Reserved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {data.lowStock.length ? (
                  data.lowStock.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2 font-semibold text-catalog-text">
                        {item.name}
                      </td>
                      <td className="py-2">{item.availableQty}</td>
                      <td className="py-2">{item.reservedQty}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-8 text-center text-catalog-text-muted" colSpan={3}>
                      No low-stock products.
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
