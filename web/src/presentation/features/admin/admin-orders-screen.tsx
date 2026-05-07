"use client";

import { cn } from "@presentation/lib/cn";
import { domainErrorMessage } from "@presentation/lib/domain-error-message";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import {
  listAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
  type OrderStatus,
} from "./admin-api";
import { formatDateTime, formatInr, statusLabel } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";

const orderStatuses: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

const statusFilters: Array<OrderStatus | "ALL"> = ["ALL", ...orderStatuses];

const statusStyles: Record<OrderStatus, string> = {
  PLACED: "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  CONFIRMED:
    "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  PACKED:
    "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  OUT_FOR_DELIVERY:
    "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  DELIVERED: "border-green-200 bg-green-50 text-green-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

const allowedStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

function statusFilterLabel(status: OrderStatus | "ALL"): string {
  return status === "ALL" ? "All" : statusLabel(status);
}

function visibleStatusOptions(status: OrderStatus): OrderStatus[] {
  return [status, ...allowedStatusTransitions[status]];
}

function orderAddress(order: AdminOrder): string {
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

function firstProductImage(item: AdminOrder["items"][number]): string | null {
  const urls = item.product?.imageUrls;
  return Array.isArray(urls) && urls.length > 0 ? urls[0] : null;
}

export function AdminOrdersScreen() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [draftStatuses, setDraftStatuses] = useState<
    Partial<Record<string, OrderStatus>>
  >({});
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data, error, isLoading, refetch } = useAdminQuery(
    ["admin", "orders", 1, 100, statusFilter],
    () => listAdminOrders(1, 100, statusFilter),
  );

  const orders = useMemo(() => data?.items ?? [], [data?.items]);

  function toggleOrder(orderId: string) {
    setStatusError(null);
    setOpenOrderId((current) => (current === orderId ? null : orderId));
  }

  function updateDraftStatus(orderId: string, status: OrderStatus) {
    setDraftStatuses((current) => ({ ...current, [orderId]: status }));
  }

  async function saveOrderStatus(order: AdminOrder) {
    const nextStatus = draftStatuses[order.id] ?? order.status;
    if (nextStatus === order.status) return;

    setSavingOrderId(order.id);
    setStatusError(null);
    try {
      await updateAdminOrderStatus(order.id, nextStatus);
      setDraftStatuses((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      await refetch();
      setOpenOrderId(order.id);
    } catch (err) {
      setStatusError(domainErrorMessage(err, "Could not update order status"));
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-catalog-text">All Orders</h1>
        <p className="text-sm text-catalog-text-muted">
          Buyer orders, fulfillment status, delivery assignment, and totals.
        </p>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-xl border border-catalog-border bg-card p-3 shadow-sm">
        {statusFilters.map((status) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                active
                  ? "border-catalog-green bg-catalog-green text-white"
                  : "border-catalog-border bg-catalog-surface text-catalog-text hover:bg-catalog-green-muted hover:text-catalog-green",
              )}
              onClick={() => {
                setStatusFilter(status);
                setOpenOrderId(null);
                setStatusError(null);
              }}
            >
              {statusFilterLabel(status)}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-catalog-input" />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-catalog-surface text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Buyer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Rider</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {orders.map((order) => {
                  const expanded = openOrderId === order.id;
                  const draftStatus = draftStatuses[order.id] ?? order.status;
                  const statusOptions = visibleStatusOptions(order.status);
                  return (
                    <Fragment key={order.id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-catalog-surface/70",
                          expanded && "bg-catalog-green-muted/40",
                        )}
                        onClick={() => toggleOrder(order.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleOrder(order.id);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-catalog-text">
                          {order.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[order.status]}`}
                          >
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-catalog-text">
                            {order.user?.businessName ?? "Unknown buyer"}
                          </p>
                          <p className="text-xs text-catalog-text-muted">
                            {order.user?.phone ?? "No phone"}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-catalog-text">
                          {formatInr(order.totalAmount)}
                        </td>
                        <td className="px-4 py-3">
                          {statusLabel(order.deliveryType)}
                        </td>
                        <td className="px-4 py-3">
                          {order.rider ? (
                            <>
                              <p className="font-semibold text-catalog-text">
                                {order.rider.name}
                              </p>
                              <p className="text-xs text-catalog-text-muted">
                                {order.rider.phone}
                              </p>
                            </>
                          ) : (
                            <span className="text-catalog-text-muted">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{order.items.length}</td>
                        <td className="px-4 py-3 text-xs text-catalog-text-muted">
                          {formatDateTime(order.createdAt)}
                        </td>
                      </tr>

                      {expanded ? (
                        <tr className="bg-catalog-surface/60">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
                              <section className="rounded-xl border border-catalog-border bg-card p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <h2 className="text-sm font-black text-catalog-text">
                                      Order items
                                    </h2>
                                    <p className="text-xs text-catalog-text-muted">
                                      {order.items.length}{" "}
                                      {order.items.length === 1
                                        ? "item"
                                        : "items"}{" "}
                                      in this order
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-catalog-green-muted px-3 py-1 text-xs font-black text-catalog-green">
                                    {formatInr(order.subtotalAmount)}
                                  </span>
                                </div>

                                <div className="divide-y divide-catalog-border">
                                  {order.items.map((item) => {
                                    const productImage =
                                      firstProductImage(item);
                                    const productName =
                                      item.product?.name ?? item.productId;
                                    const lineTotal =
                                      Number(item.priceApplied) * item.quantity;
                                    return (
                                      <div
                                        key={item.id}
                                        className="grid gap-3 py-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto]"
                                      >
                                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-catalog-border bg-catalog-surface">
                                          {productImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={productImage}
                                              alt=""
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-xs font-black text-catalog-text-muted">
                                              {productName.charAt(0)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-semibold text-catalog-text">
                                            {productName}
                                          </p>
                                          <p className="text-xs text-catalog-text-muted">
                                            {item.product?.category ??
                                              "Uncategorized"}{" "}
                                            - SKU {item.productId.slice(0, 8)}
                                          </p>
                                          <p className="mt-1 text-xs text-catalog-text-muted">
                                            Qty {item.quantity} x{" "}
                                            {formatInr(item.priceApplied)}
                                          </p>
                                        </div>
                                        <div className="text-left sm:text-right">
                                          <p className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                            Line total
                                          </p>
                                          <p className="mt-1 font-black text-catalog-text">
                                            {formatInr(lineTotal)}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>

                              <aside className="space-y-4">
                                <section className="rounded-xl border border-catalog-border bg-card p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-black text-catalog-text">
                                      Buyer details
                                    </h2>
                                    {order.user?.id ? (
                                      <Link
                                        href={`/admin/users/${order.user.id}/analytics`}
                                        className="shrink-0 rounded-full border border-catalog-green/30 bg-catalog-green-muted px-3 py-1 text-[10px] font-black uppercase tracking-wide text-catalog-green transition-colors hover:bg-catalog-green hover:text-white"
                                      >
                                        View user details
                                      </Link>
                                    ) : null}
                                  </div>
                                  <dl className="mt-3 space-y-2 text-sm">
                                    <div>
                                      <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                        Business
                                      </dt>
                                      <dd className="font-semibold text-catalog-text">
                                        {order.user?.businessName ??
                                          "Unknown buyer"}
                                      </dd>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                          Contact
                                        </dt>
                                        <dd className="font-semibold text-catalog-text">
                                          {order.user?.phone ?? "No phone"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                          Email
                                        </dt>
                                        <dd className="truncate font-semibold text-catalog-text">
                                          {order.user?.email ?? "No email"}
                                        </dd>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                          Type
                                        </dt>
                                        <dd className="font-semibold text-catalog-text">
                                          {statusLabel(
                                            order.user?.businessType ??
                                              "UNKNOWN",
                                          )}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                          GST
                                        </dt>
                                        <dd className="truncate font-semibold text-catalog-text">
                                          {order.user?.gstNumber ?? "Not added"}
                                        </dd>
                                      </div>
                                    </div>
                                    <div>
                                      <dt className="text-xs font-bold uppercase tracking-wide text-catalog-text-muted">
                                        Delivery address
                                      </dt>
                                      <dd className="leading-relaxed text-catalog-text">
                                        {orderAddress(order)}
                                      </dd>
                                    </div>
                                  </dl>
                                </section>

                                <section className="rounded-xl border border-catalog-border bg-card p-4">
                                  <h2 className="text-sm font-black text-catalog-text">
                                    Fulfillment status
                                  </h2>
                                  <div className="mt-3 flex flex-col gap-3">
                                    <label className="flex w-full flex-col gap-1.5 text-sm">
                                      <span className="font-medium text-heading">
                                        Order status
                                      </span>
                                      <select
                                        value={draftStatus}
                                        onChange={(event) =>
                                          updateDraftStatus(
                                            order.id,
                                            event.target.value as OrderStatus,
                                          )
                                        }
                                        className="min-h-11 rounded-lg border border-input-border bg-input-bg px-3 text-heading outline-none focus:border-border-focus focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
                                        disabled={statusOptions.length === 1}
                                      >
                                        {statusOptions.map((status) => (
                                          <option key={status} value={status}>
                                            {statusLabel(status)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <button
                                      type="button"
                                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-catalog-green px-4 text-sm font-bold text-white transition-colors hover:bg-catalog-green-hover disabled:cursor-not-allowed disabled:opacity-60"
                                      disabled={
                                        savingOrderId === order.id ||
                                        draftStatus === order.status
                                      }
                                      onClick={() =>
                                        void saveOrderStatus(order)
                                      }
                                    >
                                      {savingOrderId === order.id
                                        ? "Saving..."
                                        : "Update status"}
                                    </button>
                                    {statusOptions.length === 1 ? (
                                      <p className="text-xs text-catalog-text-muted">
                                        This order is already in a terminal
                                        status.
                                      </p>
                                    ) : null}
                                    {statusError ? (
                                      <p
                                        className="text-sm text-red-600"
                                        role="alert"
                                      >
                                        {statusError}
                                      </p>
                                    ) : null}
                                  </div>
                                </section>
                              </aside>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-catalog-text-muted"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
