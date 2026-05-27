"use client";

import { ProductImageCarousel } from "@presentation/components/product/product-image-carousel";
import { cn } from "@presentation/lib/cn";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminProduct } from "./admin-api";
import { deleteAdminProduct, listAdminProducts } from "./admin-api";
import { formatDateTime, formatInr } from "./admin-format";
import { useAdminQuery } from "./use-admin-query";
import { ProductCategory } from "../../../../public/constants/product-category";

const allCategories = "ALL";
const lowStockCategory = "__LOW_STOCK__";
const outOfStockCategory = "__OUT_OF_STOCK__";

function formatCount(value: number | string): string {
  return new Intl.NumberFormat("en-IN").format(Number(value));
}

function stockStateFromQty(qty: number): "out" | "low" | "ok" {
  if (qty <= 0) return "out";
  if (qty < 10) return "low";
  return "ok";
}

function ProductCard({
  product,
  onDeleted,
}: {
  product: AdminProduct;
  onDeleted: (product: AdminProduct) => Promise<void>;
}) {
  const router = useRouter();
  const imageUrls = (product.imageUrls ?? []).filter(Boolean);
  const [isDeleting, setIsDeleting] = useState(false);
  const editHref = `/admin/products/${product.id}/edit`;
  const availableQty = product.totalAvailableQty ?? 0;
  const stockState = stockStateFromQty(availableQty);

  function goToEdit() {
    router.push(editHref);
  }

  async function requestDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Hard delete "${product.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await onDeleted(product);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article
      role="link"
      tabIndex={0}
      className="group cursor-pointer overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-catalog-green/40 hover:shadow-md"
      onClick={goToEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToEdit();
        }
      }}
    >
      <ProductImageCarousel
        imageUrls={imageUrls}
        categoryLabel={product.category}
        categoryPosition="left"
        topRightClassName="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        topRight={
          <>
            <Link
              href={editHref}
              className="rounded-full border border-catalog-green/30 bg-catalog-green px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </Link>
            <button
              type="button"
              className="rounded-full border border-red-200 bg-red-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-sm disabled:opacity-70"
              onClick={requestDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting" : "Delete"}
            </button>
          </>
        }
      />

      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-2 text-base font-bold leading-tight text-catalog-text">
            {product.name}
          </h2>
          <p className="mt-1 text-xs font-medium text-catalog-text-muted">
            {product.unit}
            {product.unit === "PACK" && product.piecesPerPack
              ? ` / ${product.piecesPerPack} pieces per pack`
              : ""}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className={cn(
              "rounded-lg border p-3",
              stockState === "out"
                ? "border-red-200 bg-red-50"
                : stockState === "low"
                  ? "border-amber-200 bg-amber-50"
                  : "border-catalog-border bg-catalog-surface",
            )}
          >
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-wide",
                stockState === "out"
                  ? "text-red-500"
                  : stockState === "low"
                    ? "text-amber-600"
                    : "text-catalog-text-muted",
              )}
            >
              Available
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-black",
                stockState === "out"
                  ? "text-red-600"
                  : stockState === "low"
                    ? "text-amber-700"
                    : "text-catalog-text",
              )}
            >
              {formatCount(availableQty)}
            </p>
          </div>
          <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
              Active selling price
            </p>
            <p className="mt-1 text-lg font-black text-catalog-text">
              {product.activeSellingPrice
                ? formatInr(product.activeSellingPrice)
                : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-catalog-border pt-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
              Created at
            </p>
            <p className="mt-0.5 text-xs font-semibold text-catalog-text">
              {formatDateTime(product.createdAt)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {stockState === "out" ? (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black text-red-600">
                Out of Stock
              </span>
            ) : stockState === "low" ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                Low Stock
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-black",
                product.isPublic
                  ? "bg-catalog-green-muted text-catalog-green"
                  : "bg-catalog-input text-catalog-text-muted",
              )}
            >
              {product.isPublic ? "Public" : "Draft"}
            </span>
            <span className="text-[10px] font-bold text-catalog-text-muted">
              {product.imageUrls?.length ?? 0} images
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function AdminProductsScreen() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(allCategories);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data, error, isLoading, refetch } = useAdminQuery(
    ["admin", "products", 1, 100],
    () => listAdminProducts(1, 100),
  );

  const products = useMemo(() => data?.items ?? [], [data?.items]);
  const hasLowStock = useMemo(
    () =>
      products.some((product) => stockStateFromQty(product.totalAvailableQty ?? 0) === "low"),
    [products],
  );
  const hasOutOfStock = useMemo(
    () =>
      products.some((product) => stockStateFromQty(product.totalAvailableQty ?? 0) === "out"),
    [products],
  );
  const categories = useMemo(
    () => [
      allCategories,
      ...Array.from(
        new Set(products.map((product) => product.category)),
      ).sort(),
      ...(hasLowStock ? [lowStockCategory] : []),
      ...(hasOutOfStock ? [outOfStockCategory] : []),
    ],
    [hasLowStock, hasOutOfStock, products],
  );
  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const stockState = stockStateFromQty(product.totalAvailableQty ?? 0);
      const matchesCategory =
        category === allCategories
          ? true
          : category === lowStockCategory
            ? stockState === "low"
            : category === outOfStockCategory
              ? stockState === "out"
              : product.category === category;
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [category, products, search]);

  async function handleDelete(product: AdminProduct) {
    setDeleteError(null);
    try {
      await deleteAdminProduct(product.id);
      await refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not delete product";
      setDeleteError(message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-catalog-text">All Products</h1>
          <p className="text-sm text-catalog-text-muted">
            Search, filter, and edit products from a visual catalog view.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-catalog-green px-4 text-sm font-bold text-white hover:bg-catalog-green-hover"
        >
          Add Product
        </Link>
      </div>

      <section className="space-y-3 rounded-xl border border-catalog-border bg-card p-4 shadow-sm">
        <label className="flex w-full flex-col gap-1.5 text-sm">
          <span className="font-medium text-heading">Search products</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name or category"
            className="min-h-11 w-full rounded-lg border border-input-border bg-input-bg px-3 text-heading outline-none transition-shadow placeholder:text-input-placeholder focus:border-border-focus focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {categories.map((option) => {
            const active = category === option;
            const label =
              option === allCategories
                ? "All"
                : option === lowStockCategory
                  ? "Low Stock"
                  : option === outOfStockCategory
                    ? "Out of Stock"
                    : (ProductCategory[option as keyof typeof ProductCategory] ?? option);
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  active
                    ? "border-catalog-green bg-catalog-green text-white"
                    : "border-catalog-border bg-catalog-surface text-catalog-text hover:bg-catalog-green-muted hover:text-catalog-green",
                )}
                onClick={() => setCategory(option)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {deleteError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {deleteError}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={String(index)}
              className="h-96 animate-pulse rounded-xl bg-catalog-input"
            />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : visibleProducts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onDeleted={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-catalog-border bg-card px-4 py-12 text-center text-sm text-catalog-text-muted">
          No products match this search.
        </div>
      )}
    </div>
  );
}
