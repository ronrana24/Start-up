"use client";

import { DownloadOrderInvoiceButton } from "@presentation/components/order/download-order-invoice-button";
import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useRequireAuth } from "@presentation/hooks/use-require-auth";
import { useOrderTrackingQuery } from "@presentation/hooks/use-order-tracking-query";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import Link from "next/link";
import { useParams } from "next/navigation";

export function OrderTrackingScreen() {
  const ready = useRequireAuth();
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;
  const userId = useAuthStore((s) => s.userId);
  const { data, isPending, isError } = useOrderTrackingQuery(orderId, userId);

  if (!ready) {
    return null;
  }

  if (isPending) {
    return <div className="h-48 animate-pulse rounded-xl bg-secondary-bg" />;
  }

  if (isError || !data) {
    return (
      <Card>
        <p className="text-secondary">Order not found.</p>
        <Link href="/orders/history" className="mt-3 text-sm font-semibold text-primary">
          Back to history
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-heading">Track order</h1>
        <p className="mt-1 font-mono text-sm text-secondary">{data.id}</p>
      </div>
      <Card>
        <ol className="space-y-4">
          {data.trackingSteps.map((step, i) => (
            <li key={step.key} className="flex gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done
                    ? "bg-success-bg text-success"
                    : "bg-disabled-bg text-disabled-text"
                }`}
              >
                {i + 1}
              </div>
              <div>
                <p className="font-semibold text-heading">{step.label}</p>
                {step.completedAt ? (
                  <p className="text-xs text-muted">
                    {new Date(step.completedAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Pending</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary">Order total</span>
          <span className="font-semibold text-heading">
            {formatMoney(data.totalCents)}
          </span>
        </div>
        <DownloadOrderInvoiceButton
          order={data}
          fullWidth
          className="mt-4 min-h-10 rounded-lg"
        />
      </Card>
      <LinkButton href="/orders/history" variant="secondary" fullWidth>
        Order history
      </LinkButton>
    </div>
  );
}
