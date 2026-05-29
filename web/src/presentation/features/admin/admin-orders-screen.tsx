"use client";

import { AdminOrdersList } from "./admin-orders-list";

export function AdminOrdersScreen() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-catalog-text">All Orders</h1>
        <p className="text-sm text-catalog-text-muted">
          Buyer orders, fulfillment status, delivery assignment, and totals.
        </p>
      </div>
      <AdminOrdersList />
    </div>
  );
}
