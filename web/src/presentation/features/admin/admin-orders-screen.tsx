"use client";

import { formatDateTime, formatInr, statusLabel } from "./admin-format";
import { listAdminOrders, type OrderStatus } from "./admin-api";
import { useAdminQuery } from "./use-admin-query";

const statusStyles: Record<OrderStatus, string> = {
  PLACED: "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  CONFIRMED: "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  PACKED: "border-catalog-green-border bg-catalog-green-muted text-catalog-green",
  OUT_FOR_DELIVERY: "border-catalog-blue-light bg-catalog-blue-light text-catalog-blue",
  DELIVERED: "border-green-200 bg-green-50 text-green-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
};

export function AdminOrdersScreen() {
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "orders", 1, 100],
    () => listAdminOrders(1, 100),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-catalog-text">All Orders</h1>
        <p className="text-sm text-catalog-text-muted">
          Buyer orders, fulfillment status, delivery assignment, and totals.
        </p>
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
                {(data?.items ?? []).map((order) => (
                  <tr key={order.id} className="hover:bg-catalog-surface/70">
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
                    <td className="px-4 py-3">{statusLabel(order.deliveryType)}</td>
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
                        <span className="text-catalog-text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{order.items.length}</td>
                    <td className="px-4 py-3 text-xs text-catalog-text-muted">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 ? (
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
