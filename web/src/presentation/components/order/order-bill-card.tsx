"use client";

import type { Order } from "@domain/order";
import {
  PRIORITY_DELIVERY_SURCHARGE_CENTS,
  deliveryMethodLabel,
} from "@domain/delivery-pricing";
import { DownloadOrderInvoiceButton } from "@presentation/components/order/download-order-invoice-button";
import { Card } from "@presentation/components/ui/card";
import { formatMoney } from "@presentation/lib/format-money";
import {
  itemCount,
  lineTotalCents,
} from "@presentation/components/order/order-items-card";

function BillRow({
  label,
  value,
  hint,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  tone?: "success" | "warning";
}) {
  const valueTone =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-amber-700"
        : "text-heading";
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className={emphasis ? "font-bold text-heading" : "text-secondary"}>
          {label}
        </p>
        {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
      </div>
      <span
        className={`shrink-0 ${emphasis ? "text-base font-bold" : "font-semibold"} ${valueTone}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Transparent bill breakdown: items subtotal, standard delivery (or FREE),
 * priority surcharge (only when paid), grand total, plus payment status.
 * Server `deliveryFeeCents` is authoritative; the priority surcharge constant
 * is used only to split that recorded fee for display.
 */
export function OrderBillCard({
  order,
  showInvoiceButton = true,
}: {
  order: Order;
  showInvoiceButton?: boolean;
}) {
  const count = itemCount(order);
  const itemsSubtotalCents = order.lines.reduce(
    (sum, line) => sum + lineTotalCents(line),
    0,
  );
  const deliveryFeeCents =
    order.deliveryFeeCents ??
    Math.max(0, order.totalCents - itemsSubtotalCents);
  const prioritySurchargeCents =
    order.deliveryType === "PRIORITY"
      ? Math.min(PRIORITY_DELIVERY_SURCHARGE_CENTS, deliveryFeeCents)
      : 0;
  const standardDeliveryFeeCents = Math.max(
    0,
    deliveryFeeCents - prioritySurchargeCents,
  );
  const isFreeStandardDelivery =
    order.deliveryType === "STANDARD" && standardDeliveryFeeCents === 0;
  const paidCents = order.payment?.paidCents ?? 0;
  const dueCents = order.payment?.dueCents ?? 0;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-heading">Bill details</h3>
        <span className="rounded-md bg-secondary-bg px-2 py-1 text-[11px] font-semibold text-secondary">
          {deliveryMethodLabel(order.deliveryType)}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <BillRow
          label="Items subtotal"
          hint={`${count} ${count === 1 ? "item" : "items"}`}
          value={formatMoney(itemsSubtotalCents)}
        />
        <BillRow
          label="Standard delivery"
          hint={
            isFreeStandardDelivery
              ? "Free above the qualifying order amount"
              : undefined
          }
          value={
            isFreeStandardDelivery
              ? "FREE"
              : formatMoney(standardDeliveryFeeCents)
          }
          tone={isFreeStandardDelivery ? "success" : undefined}
        />
        {prioritySurchargeCents > 0 ? (
          <BillRow
            label="Priority surcharge"
            hint="Faster delivery handling"
            value={`+ ${formatMoney(prioritySurchargeCents)}`}
          />
        ) : null}
        <div className="border-t border-default pt-3">
          <BillRow
            label="Total"
            value={formatMoney(order.totalCents)}
            emphasis
          />
        </div>
        {order.payment ? (
          <div className="flex flex-col gap-2 rounded-lg bg-secondary-bg/60 p-3">
            <BillRow
              label="Paid online"
              value={formatMoney(paidCents)}
              tone="success"
            />
            {dueCents > 0 ? (
              <BillRow
                label="Due at delivery"
                hint="Pay the rider when your order arrives"
                value={formatMoney(dueCents)}
                tone="warning"
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {showInvoiceButton ? (
        <DownloadOrderInvoiceButton
          order={order}
          fullWidth
          className="mt-4 min-h-10 rounded-lg"
        />
      ) : null}
    </Card>
  );
}
