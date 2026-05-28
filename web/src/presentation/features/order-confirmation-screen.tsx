"use client";

import type { Order, OrderLine } from "@domain/order";
import { buildTrackingSteps } from "@infrastructure/mock/order-tracking-factory";
import { OrderSuccessCheckmark } from "@presentation/components/order/order-success-checkmark";
import { DownloadOrderInvoiceButton } from "@presentation/components/order/download-order-invoice-button";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { Card } from "@presentation/components/ui/card";
import { LinkButton } from "@presentation/components/ui/link-button";
import { useOrderQuery } from "@presentation/hooks/use-order-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

/** Development preview: plausible API-shaped order until auth + real IDs load. */
const SAMPLE_CONFIRMATION_LINES: OrderLine[] = [
  {
    productId: "CUP-ECO-12",
    title: "Eco-Friendly Coffee Cups 12oz",
    quantity: 2,
    unitPriceCents: 4225,
  },
  {
    productId: "CUT-COMP-SET",
    title: "Compostable Fork & Knife Set",
    quantity: 1,
    unitPriceCents: 6500,
  },
  {
    productId: "NAP-PREM-2P",
    title: "Premium Dinner Napkins 2-Ply",
    quantity: 4,
    unitPriceCents: 1199,
  },
];

const SAMPLE_CONFIRMATION_TOTAL = SAMPLE_CONFIRMATION_LINES.reduce(
  (sum, l) => sum + l.unitPriceCents * l.quantity,
  0,
);

function buildSampleConfirmationOrder(orderId?: string): Order {
  const id = orderId?.trim() || "cl_mp9preview_order_confirm";
  return {
    id,
    userId: "demo-user",
    lines: SAMPLE_CONFIRMATION_LINES,
    createdAt: "2026-04-30T14:32:00.000Z",
    totalCents: SAMPLE_CONFIRMATION_TOTAL,
    status: "confirmed",
    trackingSteps: buildTrackingSteps("confirmed"),
  };
}

const DEV_PREVIEW_FALLBACK = process.env.NODE_ENV === "development";

function formatOrderRef(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, "");
  const tail = (compact.slice(-6) || id.slice(-6)).toUpperCase();
  return `#ORD-${tail}`;
}

function paymentStatusLabel(status?: string): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "FAILED":
      return "Payment failed";
    case "PENDING":
      return "Pending payment";
    default:
      return "Paid";
  }
}

function TruckDeliveryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function BoxSummaryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 8v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M23 8H1V6a2 2 0 0 1 1.7-2l9-1.6a2 2 0 0 1 .6 0l9 1.6A2 2 0 0 1 23 6v2Z" />
      <path d="M3.3 7 12 12l8.7-5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-primary", className)}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function OrderConfirmationScreen() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId =
    typeof params?.orderId === "string"
      ? params.orderId
      : Array.isArray(params?.orderId)
        ? params.orderId[0]
        : undefined;
  const userId = useAuthStore((s) => s.userId);
  const fetchEnabled = Boolean(orderId && userId);
  const {
    data: queryOrder,
    isError,
    isFetching,
  } = useOrderQuery(orderId, userId);

  if (fetchEnabled && isFetching && !queryOrder) {
    return (
      <div className="space-y-3">
        <MobilePageHeader
          title="Order Confirmation"
          fallbackHref="/orders/history"
        />
        <div className="h-40 animate-pulse rounded-xl bg-secondary-bg" />
      </div>
    );
  }

  const usingDevSample =
    DEV_PREVIEW_FALLBACK &&
    (!fetchEnabled || (fetchEnabled && isError && !queryOrder));

  const data: Order | undefined =
    queryOrder ??
    (usingDevSample
      ? buildSampleConfirmationOrder(orderId || undefined)
      : undefined);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader
          title="Order Confirmation"
          fallbackHref="/orders/history"
        />
        <Card>
          <p className="text-secondary">We could not load this order.</p>
          <Link
            href="/orders/history"
            className="mt-3 inline-block text-sm font-semibold text-primary"
          >
            View order history
          </Link>
        </Card>
      </div>
    );
  }

  const itemCount = data.lines.reduce((n, l) => n + l.quantity, 0);
  const orderRef = formatOrderRef(data.id);
  const paidCents = data.payment?.paidCents ?? data.totalCents;
  const dueCents = data.payment?.dueCents ?? 0;
  const paymentIsComplete = dueCents <= 0;

  return (
    <div className="relative -mx-4 flex min-h-[calc(100svh-6rem)] flex-1 flex-col overflow-hidden bg-card shadow-sm sm:mx-0 sm:rounded-2xl sm:border sm:border-default lg:min-h-[calc(100svh-8rem)]">
      {usingDevSample ? (
        <p className="border-b border-dashed border-primary/25 bg-primary-light/40 px-3 py-2 text-center text-[11px] text-secondary">
          Development preview: sample backend order data (sign in + real order
          ID to live data).
        </p>
      ) : null}

      <MobilePageHeader
        title="Order Confirmation"
        fallbackHref="/orders/history"
        containerClassName="mx-0 border-b border-default/80 bg-page px-4 py-3"
        rightAction={
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
            aria-label="Close"
            onClick={() => router.back()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        }
      />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <section className="flex flex-col items-center border-b border-default/60 bg-card px-6 pb-8 pt-8 text-center">
          <OrderSuccessCheckmark className="mb-4" />
          <h2 className="text-xl font-bold text-heading">Order Confirmed!</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-secondary">
            Thank you for your purchase. We&apos;ve received your order and are
            getting it ready.
          </p>
          <div className="mt-4 rounded-[10px] border border-default bg-secondary-bg px-4 py-2.5">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted">
              Order number
            </span>
            <span className="text-lg font-bold tracking-tight text-primary">
              {orderRef}
            </span>
            <span className="mt-1 block font-mono text-[10px] text-muted">
              ID: {data.id}
            </span>
          </div>
        </section>

        <section className="border-b border-default/60 bg-secondary-bg/80 px-4 py-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-heading">
            <CalendarIcon />
            Expected delivery
          </h3>
          <Card className="border-default/80 p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                <TruckDeliveryIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-heading">
                  Preparing your shipment
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                  We typically prepare wholesale orders within 1–2 business
                  days. You&apos;ll see live status on the tracking page.
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-default/70 pt-3">
              <p className="text-xs font-semibold text-heading">
                Delivering to
              </p>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Address from checkout. Manage saved addresses anytime from your
                account.
              </p>
            </div>
          </Card>
        </section>

        <section className="border-b border-default/60 bg-card px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-heading">
              <BoxSummaryIcon />
              Order summary
            </h3>
            <span className="rounded-md bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>
          {data.lines.some((l) => l.hasMixedBatches) ? (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-900">
              This order includes items from multiple inventory batches with
              different pricing.
            </p>
          ) : null}
          <ul className="flex flex-col gap-0">
            {data.lines.map((line, i) => {
              const segments = line.batchSegments ?? [];
              const lineTotalCents =
                segments.length > 0
                  ? segments.reduce((sum, seg) => sum + seg.lineTotalCents, 0)
                  : line.unitPriceCents * line.quantity;
              return (
                <li
                  key={`${data.id}-${line.productId}-${i}`}
                  className="flex flex-col gap-2 border-b border-default/40 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 rounded-md border border-default bg-secondary-bg px-2 py-1 text-xs font-bold text-heading">
                        {line.quantity}×
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-heading">
                          {line.title}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          SKU: {line.productId}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-heading">
                      {formatMoney(lineTotalCents)}
                    </span>
                  </div>
                  {segments.length > 1 ? (
                    <ul className="ml-8 space-y-0.5 text-[10px] text-muted">
                      {segments.map((seg) => (
                        <li
                          key={seg.batchId}
                          className="flex items-center justify-between"
                        >
                          <span>
                            {seg.quantity} × {formatMoney(seg.unitPriceCents)}{" "}
                            (Batch #{seg.batchNumber})
                          </span>
                          <span>{formatMoney(seg.lineTotalCents)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-default pt-3">
            <span className="text-sm font-bold text-heading">Paid online</span>
            <span className="text-lg font-bold text-primary">
              {formatMoney(paidCents)}
            </span>
          </div>
          {dueCents > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-heading">
                Due at delivery
              </span>
              <span className="text-lg font-bold text-amber-700">
                {formatMoney(dueCents)}
              </span>
            </div>
          )}
        </section>

        <section className="border-b border-default/60 bg-secondary-bg/80 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-default/80 p-3 shadow-none">
              <p className="text-[10px] font-medium text-muted">
                Payment status
              </p>
              <p
                className={cn(
                  "mt-1 flex items-center gap-1 text-xs font-bold",
                  paymentIsComplete ? "text-success" : "text-amber-700",
                )}
              >
                {paymentIsComplete ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                ) : null}
                {paymentStatusLabel(data.payment?.status)}
              </p>
            </Card>
            <Card className="border-default/80 p-3 shadow-none">
              <p className="text-[10px] font-medium text-muted">Payment mode</p>
              <p className="mt-1 text-xs font-bold text-heading">
                {data.payment?.mode === "PARTIAL_UPI"
                  ? "Partial UPI"
                  : "Full UPI"}
              </p>
            </Card>
          </div>
          <DownloadOrderInvoiceButton
            order={data}
            fullWidth
            className="mt-3 min-h-10 rounded-lg"
          />
        </section>

        <section className="flex flex-col gap-3 bg-card px-4 py-4">
          <LinkButton
            href={`/orders/${data.id}/track`}
            fullWidth
            className="min-h-12 rounded-[10px] text-sm font-bold shadow-md"
          >
            Track order
          </LinkButton>
          <div className="flex gap-3">
            <LinkButton
              href="/cart"
              variant="secondary"
              className="min-h-10 flex-1 rounded-lg border border-primary/15 bg-primary-light/50 text-xs font-semibold text-primary hover:bg-primary-light"
            >
              Reorder items
            </LinkButton>
            <LinkButton
              href="/"
              variant="secondary"
              className="min-h-10 flex-1 rounded-lg text-xs font-semibold"
            >
              Continue shopping
            </LinkButton>
          </div>
        </section>

        <section className="bg-secondary-bg/80 px-6 py-6 text-center">
          <p className="text-xs text-secondary">Need help with this order?</p>
          <Link
            href="/contact"
            className="mt-2 inline-flex items-center justify-center gap-2 text-sm font-bold text-primary hover:underline"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v1a8 8 0 0 0 16 0v-1a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 14h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Contact support
          </Link>
        </section>
      </div>
    </div>
  );
}
