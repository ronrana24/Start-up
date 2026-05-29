"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getAdminUserProfile, type AdminUserProfile } from "./admin-api";
import { AdminOrdersList } from "./admin-orders-list";
import { formatInr, statusLabel } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";

function displayName(profile: AdminUserProfile["profile"]): string {
  return (
    profile.name?.trim() ||
    profile.businessName?.trim() ||
    profile.phone ||
    "Unnamed user"
  );
}

export function AdminUserOrdersScreen() {
  const params = useParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const { data, error, isLoading } = useAdminQuery(
    ["admin", "user-profile", userId],
    () => getAdminUserProfile(userId ?? ""),
  );

  if (!userId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        User id is missing.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/admin/users/${userId}`}
          className="text-xs font-bold uppercase tracking-wide text-catalog-green hover:underline"
        >
          Back to user profile
        </Link>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-catalog-text">
              {isLoading
                ? "Buyer orders"
                : data
                  ? `Orders by ${displayName(data.profile)}`
                  : "Buyer orders"}
            </h1>
            <p className="text-sm text-catalog-text-muted">
              {isLoading
                ? "Loading buyer profile…"
                : error
                  ? "Could not load buyer details. Orders below are still scoped to this user."
                  : data
                    ? `Complete order history, fulfillment status, and totals for ${
                        data.profile.businessName ?? "this buyer"
                      }.`
                    : "Complete order history, fulfillment status, and totals."}
            </p>
          </div>
          {data ? (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
              <div className="rounded-xl border border-catalog-border bg-card px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
                  Total orders
                </p>
                <p className="mt-1 text-lg font-black text-catalog-text">
                  {data.orderStats.buyer.totalOrders}
                </p>
              </div>
              <div className="rounded-xl border border-catalog-border bg-card px-4 py-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
                  Lifetime value
                </p>
                <p className="mt-1 text-lg font-black text-catalog-text">
                  {formatInr(data.orderStats.buyer.totalRevenue)}
                </p>
              </div>
              {data.profile.businessType ? (
                <div className="col-span-2 rounded-xl border border-catalog-border bg-card px-4 py-3 shadow-sm sm:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
                    Business type
                  </p>
                  <p className="mt-1 text-sm font-bold text-catalog-text">
                    {statusLabel(data.profile.businessType)}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AdminOrdersList
        userId={userId}
        emptyLabel="This buyer hasn't placed any orders yet."
      />
    </div>
  );
}
