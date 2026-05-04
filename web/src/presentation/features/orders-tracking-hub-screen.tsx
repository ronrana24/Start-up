"use client";

import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import Link from "next/link";

export function OrdersTrackingHubScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.userId);
  const { data, isPending, isError, refetch } = useOrdersQuery(
    isAuthenticated ? userId : null,
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-heading">Tracking</h1>
        <Card>
          <p className="text-sm text-secondary">
            Sign in to see your orders and track shipments.
          </p>
          <LinkButton href="/login" className="mt-4" fullWidth>
            Sign in
          </LinkButton>
        </Card>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded bg-secondary-bg" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={String(i)} className="h-24 animate-pulse rounded-xl bg-secondary-bg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
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
    );
  }

  const sorted = [...data].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-heading">Tracking</h1>
        <p className="text-sm text-secondary">
          Open an order to see delivery milestones.
        </p>
      </div>
      {sorted.length === 0 ? (
        <Card>
          <p className="text-secondary">No orders yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-semibold text-primary">
            Start shopping
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((order) => (
            <Card key={order.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-heading">
                  {order.id}
                </p>
                <span className="rounded-full bg-chip-inactive px-2 py-0.5 text-xs font-medium capitalize text-chip-inactive-text">
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-secondary">
                {formatMoney(order.totalCents)} ·{" "}
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
              <Link
                href={`/orders/${order.id}/track`}
                className="text-sm font-semibold text-primary"
              >
                Track shipment
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
