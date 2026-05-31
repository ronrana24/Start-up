"use client";

import type { Order, OrderLine } from "@domain/order";
import { Card } from "@presentation/components/ui/card";
import { formatMoney } from "@presentation/lib/format-money";

export function lineTotalCents(line: OrderLine): number {
  const segments = line.batchSegments ?? [];
  if (segments.length > 0) {
    return segments.reduce((sum, seg) => sum + seg.lineTotalCents, 0);
  }
  return line.unitPriceCents * line.quantity;
}

export function itemCount(order: Order): number {
  return order.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Order line items rendered with product thumbnail, quantity badge, unit price
 * and per-line total. Shared between the dedicated tracking page and the
 * tracking hub so buyers see the same breakdown wherever they look.
 */
export function OrderItemsCard({ order }: { order: Order }) {
  const count = itemCount(order);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-heading">Order items</h3>
        <span className="rounded-md bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <ul className="flex flex-col">
        {order.lines.map((line, i) => {
          const segments = line.batchSegments ?? [];
          const totalForLine = lineTotalCents(line);
          return (
            <li
              key={`${order.id}-${line.productId}-${i}`}
              className="flex flex-col gap-2 border-b border-default/40 py-3 first:pt-0 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 rounded-lg border border-default bg-secondary-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.imageUrl || "/placeholder-product.svg"}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full border border-card bg-heading px-1 text-center text-[10px] font-black leading-[1.1rem] text-card">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-heading">
                      {line.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {formatMoney(line.unitPriceCents)} each
                      {line.unit ? ` · ${line.unit.toLowerCase()}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-heading">
                  {formatMoney(totalForLine)}
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
    </Card>
  );
}
