"use client";

import { cn } from "@presentation/lib/cn";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  getAdminUserProfile,
  type AdminAddress,
  type AdminProfileOrder,
  type AdminUserProfile,
  type OrderStatus,
  type PricingDiscountType,
} from "./admin-api";
import { formatDateTime, formatInr, statusLabel } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";

const orderStatusStyles: Record<OrderStatus, string> = {
  PLACED: "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  RIDER_ASSIGNED:
    "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  PICKED_UP:
    "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  CONFIRMED:
    "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  PACKED:
    "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  OUT_FOR_DELIVERY:
    "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  DELIVERED: "border-green-200 bg-green-50 text-green-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

function displayName(profile: AdminUserProfile["profile"]): string {
  return (
    profile.name?.trim() ||
    profile.businessName?.trim() ||
    profile.phone ||
    "Unnamed user"
  );
}

function fallback(value: string | null | undefined): string {
  return value?.trim() || "Not added";
}

function formatCount(value: number | string): string {
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

function formatDistance(value: number): string {
  if (!value) return "0 km";
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value)} km`;
}

function formatMinutes(value: number): string {
  if (!value) return "No completed trips";
  if (value < 60) return `${Math.round(value)} mins`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function shortId(value: string): string {
  return value.length > 10 ? value.slice(0, 10) : value;
}

function roleBadgeClass(role: string): string {
  if (role === "ADMIN")
    return "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue";
  if (role === "RIDER") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-catalog-green-border bg-catalog-green-muted text-catalog-green";
}

function permissionSummary(role: string): string {
  if (role === "ADMIN") {
    return "Can access admin operations, user oversight, catalog, orders, and analytics.";
  }
  if (role === "RIDER") {
    return "Can access rider workflows, delivery assignment, location updates, and order fulfillment tools.";
  }
  return "Can access buyer catalog, cart, checkout, order history, and buyer-specific pricing.";
}

function addressText(address: AdminAddress): string {
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");
}

function orderAddress(order: AdminProfileOrder): string {
  const address = order.addressSnapshot;
  if (!address) return "No address snapshot";
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.pincode].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" - ");
}

function pinnedAddressLocation(address: AdminAddress): string | null {
  if (
    typeof address.latitude !== "number" ||
    typeof address.longitude !== "number"
  ) {
    return null;
  }
  const accuracy =
    typeof address.locationAccuracyMeters === "number"
      ? ` · ${Math.round(address.locationAccuracyMeters)}m accuracy`
      : "";
  return `${address.latitude.toFixed(6)}, ${address.longitude.toFixed(6)}${accuracy}`;
}

function discountLabel(type: PricingDiscountType, value: number): string {
  return type === "PERCENT_OFF" ? `${value}% off` : `${formatInr(value)} off`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatLocation(value: unknown): string {
  if (!isRecord(value)) return "No location uploaded";
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const heading = Number(value.heading);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "Location payload unavailable";
  }
  const base = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return Number.isFinite(heading)
    ? `${base} / heading ${Math.round(heading)}°`
    : base;
}

function StatusBadge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-catalog-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-sm font-bold text-catalog-text">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs leading-relaxed text-catalog-text-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
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

function CopyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = value?.trim() || "";

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-catalog-text-muted">
        {label}
      </p>
      <div className="mt-1 flex min-w-0 items-center gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold text-catalog-text",
            mono && "font-mono text-xs",
            !text && "text-catalog-text-muted",
          )}
          title={text || "Not added"}
        >
          {text || "Not added"}
        </p>
        <button
          type="button"
          disabled={!text}
          className="shrink-0 rounded-md border border-catalog-border bg-card px-2 py-1 text-[11px] font-bold text-catalog-text-muted transition-colors hover:bg-catalog-input disabled:cursor-not-allowed disabled:opacity-50"
          onClick={copy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-catalog-border bg-catalog-surface px-4 py-8 text-center text-sm text-catalog-text-muted">
      {children}
    </div>
  );
}

function StatusBreakdown({
  rows,
}: {
  rows: Array<{ status: OrderStatus; count: number }>;
}) {
  const activeRows = rows.filter((row) => row.count > 0);
  if (!activeRows.length) {
    return <EmptyState>No order activity recorded yet.</EmptyState>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {activeRows.map((row) => (
        <div
          key={row.status}
          className="flex items-center justify-between gap-3 rounded-lg border border-catalog-border bg-catalog-surface px-3 py-2"
        >
          <StatusBadge className={orderStatusStyles[row.status]}>
            {statusLabel(row.status)}
          </StatusBadge>
          <span className="text-sm font-bold text-catalog-text">
            {formatCount(row.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RecentOrdersTable({
  orders,
  perspective,
}: {
  orders: AdminProfileOrder[];
  perspective: "buyer" | "rider";
}) {
  if (!orders.length) {
    return <EmptyState>No recent orders for this user.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-catalog-text-muted">
          <tr>
            <th className="pb-2">Order</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">
              {perspective === "rider" ? "Buyer" : "Rider"}
            </th>
            <th className="pb-2">Amount</th>
            <th className="pb-2">Address</th>
            <th className="pb-2">Activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-catalog-border">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="py-3 align-top font-mono text-xs text-catalog-text">
                {shortId(order.id)}
              </td>
              <td className="py-3 align-top">
                <StatusBadge className={orderStatusStyles[order.status]}>
                  {statusLabel(order.status)}
                </StatusBadge>
              </td>
              <td className="py-3 align-top">
                <p className="font-semibold text-catalog-text">
                  {perspective === "rider"
                    ? order.user.businessName
                    : (order.rider?.name ?? "Unassigned")}
                </p>
                <p className="text-xs text-catalog-text-muted">
                  {perspective === "rider"
                    ? order.user.phone
                    : (order.rider?.phone ?? "No rider")}
                </p>
              </td>
              <td className="py-3 align-top font-semibold text-catalog-text">
                {formatInr(order.totalAmount)}
              </td>
              <td className="max-w-[16rem] py-3 align-top text-xs leading-relaxed text-catalog-text-muted">
                <span className="line-clamp-2">{orderAddress(order)}</span>
              </td>
              <td className="py-3 align-top text-xs text-catalog-text-muted">
                <p>Created {formatDateTime(order.createdAt)}</p>
                {order.deliveredAt ? (
                  <p>Delivered {formatDateTime(order.deliveredAt)}</p>
                ) : null}
                {order.deliveryDistanceKm ? (
                  <p>{formatDistance(order.deliveryDistanceKm)}</p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonView() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-xl bg-catalog-input" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={String(index)}
            className="h-28 animate-pulse rounded-xl bg-catalog-input"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={String(index)}
            className="h-48 animate-pulse rounded-xl bg-catalog-input"
          />
        ))}
      </div>
    </div>
  );
}

export function AdminUserDetailScreen() {
  const params = useParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;
  const { data, error, isLoading, refetch } = useAdminQuery(
    ["admin", "user-profile", userId],
    () => getAdminUserProfile(userId ?? ""),
  );

  const primaryRecentOrders = useMemo(() => {
    if (!data) return [];
    return data.profile.role === "RIDER"
      ? data.activity.riderRecentOrders
      : data.activity.buyerRecentOrders;
  }, [data]);

  if (!userId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        User id is missing.
      </div>
    );
  }

  if (isLoading) {
    return <SkeletonView />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/users"
          className="text-xs font-bold uppercase tracking-wide text-catalog-green hover:underline"
        >
          All users
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error ?? "Could not load user profile."}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { profile, orderStats, pricing, rider, addresses, activity } = data;
  const userName = displayName(profile);

  return (
    <div className="space-y-5">
      <div className="sticky top-[7rem] z-20 -mx-4 border-b border-catalog-border bg-catalog-surface/95 px-4 py-4 backdrop-blur lg:top-[4.75rem] lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-catalog-green-muted text-xl font-black text-catalog-green">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link
                href="/admin/users"
                className="text-xs font-bold uppercase tracking-wide text-catalog-green hover:underline"
              >
                All users
              </Link>
              <h1 className="mt-1 truncate text-2xl font-bold text-catalog-text">
                {userName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge className={roleBadgeClass(profile.role)}>
                  {statusLabel(profile.role)}
                </StatusBadge>
                <StatusBadge
                  className={
                    profile.isOnboardingCompleted
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }
                >
                  {profile.isOnboardingCompleted
                    ? "Onboarding complete"
                    : "Onboarding pending"}
                </StatusBadge>
                {profile.auth.providers.length ? (
                  <span className="text-xs font-semibold text-catalog-text-muted">
                    {profile.auth.providers.join(" + ")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.role === "BUYER" ? (
              <>
                <Link
                  href={`/admin/users/${profile.id}/analytics`}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-catalog-border bg-card px-4 text-sm font-bold text-catalog-text hover:bg-catalog-input"
                >
                  Buyer analytics
                </Link>
                <Link
                  href={`/admin/users/${profile.id}/pricing`}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-catalog-green px-4 text-sm font-bold text-white hover:bg-catalog-green/90"
                >
                  Special pricing
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Buyer orders"
          value={formatCount(orderStats.buyer.totalOrders)}
          hint={`${formatInr(orderStats.buyer.totalRevenue)} lifetime value`}
        />
        <MetricCard
          label="Average order"
          value={formatInr(orderStats.buyer.averageOrderValue)}
          hint={
            orderStats.buyer.lastOrderAt
              ? `Last order ${formatDateTime(orderStats.buyer.lastOrderAt)}`
              : "No buyer orders yet"
          }
        />
        <MetricCard
          label="Addresses"
          value={formatCount(addresses.length)}
          hint={`${formatCount(profile.counts.pricingRules)} pricing rules`}
        />
        <MetricCard
          label={profile.role === "RIDER" ? "Rider deliveries" : "Last active"}
          value={
            profile.role === "RIDER"
              ? formatCount(orderStats.rider.totalOrders)
              : activity.lastActiveAt
                ? formatDateTime(activity.lastActiveAt)
                : "No activity"
          }
          hint={
            profile.role === "RIDER"
              ? `${formatDistance(orderStats.rider.totalDistanceKm)} tracked distance`
              : "Latest user, order, or device signal"
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <div className="space-y-5">
          <SectionCard title="Basic Information">
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="User ID" value={profile.id} mono />
              <CopyField label="Display name" value={profile.name} />
              <CopyField label="Business name" value={profile.businessName} />
              <CopyField
                label="Business type"
                value={statusLabel(profile.businessType)}
              />
              <CopyField label="GST number" value={profile.gstNumber} mono />
              <CopyField
                label="Created"
                value={formatDateTime(profile.createdAt)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Contact & Authentication"
            subtitle="Sensitive credentials are not exposed. Only safe provider metadata is shown."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="Phone" value={profile.phone} />
              <CopyField label="Email" value={profile.email} />
              <CopyField
                label="Auth providers"
                value={
                  profile.auth.providers.length
                    ? profile.auth.providers.join(", ")
                    : "No provider"
                }
              />
              <CopyField
                label="Last profile update"
                value={formatDateTime(profile.updatedAt)}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Delivery Address"
            subtitle="Default address is prioritized first for quick operational checks."
          >
            {addresses.length ? (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="rounded-lg border border-catalog-border bg-catalog-surface p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="text-sm font-bold text-catalog-text">
                        {address.city}, {address.state}
                      </p>
                      {address.isDefault ? (
                        <StatusBadge className="border-catalog-green-border bg-catalog-green-muted text-catalog-green">
                          Default
                        </StatusBadge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-relaxed text-catalog-text-muted">
                      {addressText(address)}
                    </p>
                    <p className="mt-2 font-mono text-xs text-catalog-text-muted">
                      {address.pincode}
                    </p>
                    {pinnedAddressLocation(address) ? (
                      <p className="mt-2 font-mono text-xs text-catalog-green">
                        {pinnedAddressLocation(address)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-bold text-amber-700">
                        No pinned delivery coordinates
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No saved addresses for this user.</EmptyState>
            )}
          </SectionCard>

          <SectionCard title="Recent Activity">
            <RecentOrdersTable
              orders={primaryRecentOrders}
              perspective={profile.role === "RIDER" ? "rider" : "buyer"}
            />
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Account Status">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <StatusBadge className={roleBadgeClass(profile.role)}>
                  {statusLabel(profile.role)}
                </StatusBadge>
                <StatusBadge
                  className={
                    profile.isOnboardingCompleted
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-orange-200 bg-orange-50 text-orange-700"
                  }
                >
                  {profile.isOnboardingCompleted ? "Ready" : "Needs onboarding"}
                </StatusBadge>
              </div>
              <p className="text-sm leading-relaxed text-catalog-text-muted">
                {permissionSummary(profile.role)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <CopyField
                  label="Last active"
                  value={
                    activity.lastActiveAt
                      ? formatDateTime(activity.lastActiveAt)
                      : null
                  }
                />
                <CopyField
                  label="Account updated"
                  value={formatDateTime(profile.updatedAt)}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Order Statistics"
            subtitle="Server-side aggregates keep the detail payload lightweight."
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                  Buyer lifecycle
                </p>
                <StatusBreakdown rows={orderStats.buyer.byStatus} />
              </div>
              {profile.role === "RIDER" || rider ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                    Rider lifecycle
                  </p>
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
                      <p className="text-xs text-catalog-text-muted">
                        Recent avg delivery
                      </p>
                      <p className="mt-1 text-lg font-bold text-catalog-text">
                        {formatMinutes(orderStats.rider.averageDeliveryMinutes)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
                      <p className="text-xs text-catalog-text-muted">
                        Distance tracked
                      </p>
                      <p className="mt-1 text-lg font-bold text-catalog-text">
                        {formatDistance(orderStats.rider.totalDistanceKm)}
                      </p>
                    </div>
                  </div>
                  <StatusBreakdown rows={orderStats.rider.byStatus} />
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Payment & Pricing">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
                <p className="text-xs text-catalog-text-muted">Pricing rules</p>
                <p className="mt-1 text-xl font-bold text-catalog-text">
                  {formatCount(pricing.totalRules)}
                </p>
              </div>
              <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
                <p className="text-xs text-catalog-text-muted">Active rules</p>
                <p className="mt-1 text-xl font-bold text-catalog-text">
                  {formatCount(pricing.activeRules)}
                </p>
              </div>
            </div>
            {pricing.recentRules.length ? (
              <div className="space-y-2">
                {pricing.recentRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-lg border border-catalog-border bg-catalog-surface p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-catalog-text">
                          {rule.product.name}
                        </p>
                        <p className="text-xs text-catalog-text-muted">
                          {rule.product.category}
                          {rule.product.activeSellingPrice != null
                            ? ` / active ${formatInr(rule.product.activeSellingPrice)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge
                        className={
                          rule.isActive
                            ? "border-catalog-green-border bg-catalog-green-muted text-catalog-green"
                            : "border-catalog-border bg-catalog-input text-catalog-text-muted"
                        }
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-catalog-text">
                      {discountLabel(rule.discountType, rule.discountValue)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>
                No buyer-specific payment or pricing records.
              </EmptyState>
            )}
          </SectionCard>

          <SectionCard title="Rider Metadata">
            {rider ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <CopyField label="Rider ID" value={rider.id} mono />
                  <CopyField label="Rider phone" value={rider.phone} />
                  <CopyField
                    label="Current location"
                    value={formatLocation(rider.currentLocation)}
                  />
                  <CopyField
                    label="Rider updated"
                    value={formatDateTime(rider.updatedAt)}
                  />
                </div>
                <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                      Devices
                    </p>
                    <span className="text-xs font-bold text-catalog-text">
                      {formatCount(rider._count.devices)}
                    </span>
                  </div>
                  {rider.devices.length ? (
                    <div className="space-y-2">
                      {rider.devices.map((device) => (
                        <div
                          key={device.id}
                          className="rounded-md border border-catalog-border bg-card p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-catalog-text">
                              {fallback(device.platform)}
                            </p>
                            <StatusBadge
                              className={
                                device.isActive
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                              }
                            >
                              {device.isActive ? "Active" : "Inactive"}
                            </StatusBadge>
                          </div>
                          <p className="mt-1 text-xs text-catalog-text-muted">
                            Last seen {formatDateTime(device.lastSeenAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState>
                      No rider devices have been registered.
                    </EmptyState>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState>No rider profile is linked to this user.</EmptyState>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
