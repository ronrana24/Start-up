"use client";

import Link from "next/link";
import { formatDateTime, formatInr } from "./admin-format";
import { listAdminProducts } from "./admin-api";
import { useAdminQuery } from "./use-admin-query";

export function AdminProductsScreen() {
  const { data, error, isLoading } = useAdminQuery(
    ["admin", "products", 1, 100],
    () => listAdminProducts(1, 100),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-catalog-text">All Products</h1>
          <p className="text-sm text-catalog-text-muted">
            Catalog and inventory visibility for wholesale operations.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-catalog-green px-4 text-sm font-bold text-white hover:bg-catalog-green-hover"
        >
          Add Product
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm">
        {isLoading ? (
          <div className="h-64 animate-pulse bg-catalog-input" />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-catalog-surface text-xs uppercase text-catalog-text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Base price</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Reserved</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-catalog-border">
                {(data?.items ?? []).map((product) => (
                  <tr key={product.id} className="hover:bg-catalog-surface/70">
                    <td className="px-4 py-3 font-semibold text-catalog-text">
                      {product.name}
                    </td>
                    <td className="px-4 py-3">{product.category}</td>
                    <td className="px-4 py-3">{product.unit}</td>
                    <td className="px-4 py-3">{formatInr(product.basePrice)}</td>
                    <td className="px-4 py-3">
                      {product.inventory?.availableQty ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {product.inventory?.reservedQty ?? 0}
                    </td>
                    <td className="px-4 py-3 text-xs text-catalog-text-muted">
                      {formatDateTime(product.createdAt)}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-catalog-text-muted">
                      No products found.
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
