"use client";

import {
  activeTierIndex,
  pricePerCaseCents,
  productHasSpecialPrice,
  productBulkTiersSorted,
  productGalleryUrls,
} from "@domain/product-pricing";
import type { OrderLine } from "@domain/order";
import type { Product } from "@domain/product";
import { ProductImageCarousel } from "@presentation/components/product/product-image-carousel";
import { DesktopCartPill } from "@presentation/components/shop/desktop-cart-pill";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { useOrdersQuery } from "@presentation/hooks/use-orders-query";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useAuthStore } from "@presentation/state/auth-store";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SortKey = "best" | "price-asc" | "price-desc";
type QuickReorderItem = {
  product: Product;
  line: OrderLine;
};

function matchesSearch(p: Product, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return (
    p.title.toLowerCase().includes(s) ||
    (p.brand?.toLowerCase().includes(s) ?? false) ||
    (p.sku?.toLowerCase().includes(s) ?? false)
  );
}

function isEcoProduct(p: Product): boolean {
  const fromBadge = p.badges?.some((b) =>
    /eco|compost|green|nature|kraft/i.test(b.label),
  );
  const blob = `${p.title} ${p.description}`.toLowerCase();
  return (
    !!fromBadge ||
    blob.includes("eco") ||
    blob.includes("compost") ||
    blob.includes("bamboo")
  );
}

function isBulkPack(p: Product): boolean {
  const pack = `${p.packSizeNote ?? ""} ${p.title}`;
  return (
    /\b(250|500|1000)\s*ct\b/i.test(pack) || /bulk/i.test(pack.toLowerCase())
  );
}

function pluralUnit(unit: string): string {
  if (unit.endsWith("s")) return unit;
  if (unit === "piece") return "pieces";
  return `${unit}s`;
}

function productUnit(product: Product): string {
  return product.unitLabel ?? "case";
}

function packNote(product: Product): string | null {
  const note = product.packSizeNote?.trim();
  if (!note) return null;
  if (note.toLowerCase() === productUnit(product).toLowerCase()) return null;
  return note;
}

function tierHint(
  p: Product,
  quantity = p.moqCases ?? 1,
): { label: string; price: string; detail: string } | null {
  if (productHasSpecialPrice(p)) return null;
  const tiers = productBulkTiersSorted(p);
  if (!tiers.length) return null;
  const safeQuantity = Math.max(quantity, p.moqCases ?? 1);
  const unit = productUnit(p);
  const activeIndex = activeTierIndex(p, safeQuantity);
  const activeTier = activeIndex == null ? null : (tiers[activeIndex] ?? null);
  const nextTier = tiers.find((tier) => safeQuantity < tier.minCases);
  const t = activeTier ?? nextTier ?? tiers[0]!;
  return {
    label: `${t.minCases}+ ${pluralUnit(unit)}`,
    price: `${formatMoney(t.priceCents, p.currency)}/ea`,
    detail: activeTier
      ? nextTier
        ? `Current tier. ${nextTier.minCases - safeQuantity} more for ${formatMoney(
            nextTier.priceCents,
            p.currency,
          )}/ea.`
        : "Best bulk tier applied."
      : `${Math.max(0, t.minCases - safeQuantity)} more to unlock.`,
  };
}

function productTitleKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function reorderQuantityLabel(product: Product, quantity: number): string {
  const unit = productUnit(product);
  const count = Math.max(0, Math.floor(quantity));
  return `${count} ${count === 1 ? unit : pluralUnit(unit)}`;
}

function orderedUnitPriceCents(product: Product, line: OrderLine): number {
  return line.unitPriceCents > 0
    ? line.unitPriceCents
    : pricePerCaseCents(product, line.quantity);
}

export function CatalogScreen() {
  const { data: raw, isPending, isError, refetch } = useProductsQuery();
  const userId = useAuthStore((s) => s.userId);
  const { data: orders } = useOrdersQuery(userId);
  const lines = useCartStore((s) => s.lines);
  const upsertProductLine = useCartStore((s) => s.upsertProductLine);
  const setQuantity = useCartStore((s) => s.setQuantity);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("best");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ecoOnly, setEcoOnly] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);

  const qtyFor = (id: string) =>
    lines.find((l) => l.productId === id)?.quantity ?? 0;

  const filteredSorted = useMemo(() => {
    if (!raw?.length) return [];
    let list = raw.filter((p) => matchesSearch(p, search));
    if (inStockOnly) list = list.filter((p) => p.inStock !== false);
    if (ecoOnly) list = list.filter(isEcoProduct);
    if (bulkOnly) list = list.filter(isBulkPack);
    const copy = [...list];
    if (sort === "price-asc") {
      copy.sort((a, b) => a.priceCents - b.priceCents);
    } else if (sort === "price-desc") {
      copy.sort((a, b) => b.priceCents - a.priceCents);
    }
    return copy;
  }, [raw, search, sort, inStockOnly, ecoOnly, bulkOnly]);

  const latestOrder = useMemo(() => {
    if (!orders?.length) return null;
    return (
      [...orders].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0] ?? null
    );
  }, [orders]);

  const quickReorder = useMemo(() => {
    if (!raw?.length || !latestOrder?.lines.length) return [];

    const productsById = new Map(raw.map((p) => [p.id, p] as const));
    const productsByTitle = new Map(
      raw.map((p) => [productTitleKey(p.title), p] as const),
    );
    const seen = new Set<string>();
    const items: QuickReorderItem[] = [];

    for (const line of latestOrder.lines) {
      const product =
        productsById.get(line.productId) ??
        productsByTitle.get(productTitleKey(line.title));

      if (!product || seen.has(product.id)) continue;
      seen.add(product.id);
      items.push({ product, line });
    }

    return items;
  }, [raw, latestOrder]);

  const latestOrderHistoryHref = latestOrder
    ? `/orders/history#order-${latestOrder.id}`
    : "/orders/history";

  function adjustCart(p: Product, delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const cur = qtyFor(p.id);
    const moq = p.moqCases ?? 1;
    let next: number;
    if (delta < 0) {
      if (cur <= 0) return;
      next = cur - 1;
      if (next < moq) next = 0;
    } else {
      next = cur === 0 ? moq : Math.min(999, cur + 1);
    }
    if (next === 0) {
      setQuantity(p.id, 0);
      return;
    }
    upsertProductLine(p, next, pricePerCaseCents(p, next));
  }

  function quickReorderAdd(item: QuickReorderItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const orderedQuantity = Math.max(1, Math.floor(item.line.quantity));
    const currentQuantity = qtyFor(item.product.id);
    const orderedPriceCents = orderedUnitPriceCents(item.product, item.line);
    upsertProductLine(
      {
        ...item.product,
        priceCents: orderedPriceCents,
        pricingSource: "BASE",
        specialPricing: null,
      },
      Math.min(999, currentQuantity + orderedQuantity),
      orderedPriceCents,
    );
  }

  if (isPending) {
    return (
      <div className="min-h-[50vh] bg-catalog-surface px-4 pt-4">
        <MobilePageHeader title="Product Catalog" fallbackHref="/" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={String(i)}
              className="h-56 animate-pulse rounded-xl bg-catalog-input"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !raw) {
    return (
      <div className="bg-catalog-surface px-4 py-8 text-center">
        <MobilePageHeader title="Product Catalog" fallbackHref="/" />
        <p className="text-catalog-text-muted">Could not load products.</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-catalog-green"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-catalog-surface text-catalog-text">
      <MobilePageHeader
        title="Product Catalog"
        fallbackHref="/"
        containerClassName="border-b border-catalog-border/50 bg-catalog-surface px-4 py-3 shadow-sm"
      >
        <div className="mb-3">
          <label className="flex h-10 items-stretch overflow-hidden rounded-[10px] border border-catalog-border bg-catalog-input transition-colors focus-within:border-catalog-green focus-within:bg-white focus-within:shadow-[var(--shadow-catalog-focus)]">
            <span className="flex w-10 items-center justify-center text-catalog-text-muted">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, SKUs, brands…"
              className="min-w-0 flex-1 border-0 bg-transparent pr-3 text-sm font-medium text-catalog-text outline-none placeholder:text-catalog-text-muted/60"
            />
            <span className="flex w-10 items-center justify-center border-l border-catalog-border/50 text-catalog-text-muted">
              <BarcodeIcon className="h-4 w-4" />
            </span>
          </label>
        </div>

        <div className="pb-2">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-catalog-green-border bg-catalog-green-muted px-3 text-xs font-semibold text-catalog-green"
            >
              <SlidersIcon className="h-2.5 w-2.5" />
              Filters
            </button>
            <button
              type="button"
              onClick={() => setInStockOnly((v) => !v)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                inStockOnly
                  ? "border-catalog-green-border bg-catalog-green-muted text-catalog-green"
                  : "border-catalog-border bg-catalog-input text-catalog-text hover:bg-catalog-border/30",
              )}
            >
              In Stock Only
            </button>
            <button
              type="button"
              onClick={() => setEcoOnly((v) => !v)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                ecoOnly
                  ? "border-catalog-green-border bg-catalog-green-muted text-catalog-green"
                  : "border-catalog-border bg-catalog-input text-catalog-text hover:bg-catalog-border/30",
              )}
            >
              Eco-Friendly
            </button>
            <button
              type="button"
              onClick={() => setBulkOnly((v) => !v)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                bulkOnly
                  ? "border-catalog-green-border bg-catalog-green-muted text-catalog-green"
                  : "border-catalog-border bg-catalog-input text-catalog-text hover:bg-catalog-border/30",
              )}
            >
              Bulk Packs
            </button>
          </div>
        </div>
      </MobilePageHeader>

      <div className="flex flex-1 flex-col overflow-y-auto pb-36">
        {quickReorder.length > 0 ? (
          <section className="pt-4">
            <div className="mb-3 flex items-center justify-between px-4">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-catalog-text">
                <RotateIcon className="h-4 w-4 text-catalog-green" />
                Quick Reorder
              </h2>
              <Link
                href={latestOrderHistoryHref}
                className="text-xs font-medium text-catalog-blue hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4">
              {quickReorder.map((item) => {
                const p = item.product;
                const orderedPriceCents = orderedUnitPriceCents(p, item.line);
                return (
                  <div
                    key={`${latestOrder?.id ?? "latest"}-${p.id}`}
                    className="flex w-[140px] shrink-0 flex-col gap-2 rounded-xl border border-catalog-border/50 bg-card p-3 shadow-sm"
                  >
                    <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg bg-catalog-input p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-full w-full object-contain mix-blend-multiply"
                      />
                      <span className="absolute right-1 top-1 max-w-[80%] truncate rounded border border-catalog-border bg-card px-1.5 py-0.5 text-[9px] font-bold text-catalog-text">
                        {reorderQuantityLabel(p, item.line.quantity)}
                      </span>
                    </div>
                    <div>
                      <p className="mb-0.5 line-clamp-1 text-[10px] font-medium text-catalog-text-muted">
                        {p.brand ?? "—"}
                      </p>
                      <p className="line-clamp-2 text-xs font-semibold leading-tight text-catalog-text">
                        {p.title}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <div>
                        <span className="text-sm font-bold text-catalog-text">
                          {formatMoney(orderedPriceCents, p.currency)}
                        </span>
                        <span className="block text-[9px] font-bold text-catalog-text-muted">
                          Last ordered price
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => quickReorderAdd(item, e)}
                        disabled={p.inStock === false}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-catalog-green-muted text-catalog-green transition-colors hover:bg-catalog-green hover:text-white disabled:opacity-40"
                        aria-label={`Add ${reorderQuantityLabel(p, item.line.quantity)} of ${p.title}`}
                      >
                        <PlusIcon className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section id="all-disposables" className="px-4 pb-8">
          <div className="mb-4 mt-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight text-catalog-text">
              All Disposables
            </h2>
            <label className="flex shrink-0 items-center gap-1 text-xs font-medium text-catalog-text-muted">
              <span>Sort:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="max-w-[9rem] cursor-pointer appearance-none border-0 bg-transparent pr-5 text-catalog-text outline-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c757d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0 center",
                }}
              >
                <option value="best">Best Sellers</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {filteredSorted.map((p) => (
              <CatalogProductCard
                key={p.id}
                product={p}
                qty={qtyFor(p.id)}
                onAdjust={(delta, e) => adjustCart(p, delta, e)}
              />
            ))}
          </div>

          {filteredSorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-catalog-text-muted">
              No products match your filters.
            </p>
          ) : null}
        </section>
      </div>

      <DesktopCartPill />
    </div>
  );
}

function CatalogProductCard({
  product: p,
  qty,
  onAdjust,
}: {
  product: Product;
  qty: number;
  onAdjust: (delta: number, e: React.MouseEvent) => void;
}) {
  const router = useRouter();
  const out = p.inStock === false;
  const displayQty = qty > 0 ? qty : (p.moqCases ?? 1);
  const hint = tierHint(p, displayQty);
  const hasSpecialPrice = productHasSpecialPrice(p);
  const unit = productUnit(p);
  const note = packNote(p);
  const unitPriceCents = pricePerCaseCents(p, displayQty);
  const imageUrls = productGalleryUrls(p);

  function goToDetail() {
    router.push(`/products/${p.id}`);
  }

  return (
    <article
      role="link"
      tabIndex={0}
      className={cn(
        "group flex min-h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-catalog-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-catalog-green/40 hover:shadow-md",
        out && "opacity-75",
      )}
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToDetail();
        }
      }}
    >
      <ProductImageCarousel
        imageUrls={imageUrls}
        categoryLabel={p.brand ?? "General"}
        categoryPosition="left"
        className={cn("h-44 sm:h-52 lg:h-48 xl:h-44", out && "grayscale")}
        centerOverlay={
          out ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-catalog-surface/40 backdrop-blur-[1px]">
              <span className="rounded bg-catalog-text px-2 py-1 text-[10px] font-bold text-white">
                Out of Stock
              </span>
            </div>
          ) : null
        }
      />

      <div className="flex flex-1 flex-col space-y-3 p-3 sm:p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-catalog-text sm:text-base">
            {p.title}
          </h3>
          {note ? (
            <p className="mt-1 line-clamp-1 text-xs font-medium text-catalog-text-muted">
              {note}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-catalog-border bg-catalog-surface p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-catalog-text-muted">
            Price
          </p>
          <div className="mt-1">
            {hasSpecialPrice && p.specialPricing?.originalPriceCents ? (
              <span className="block text-[10px] font-semibold text-catalog-text-muted line-through">
                {formatMoney(p.specialPricing.originalPriceCents, p.currency)}
              </span>
            ) : null}
            <span className="text-lg font-black text-catalog-text">
              {formatMoney(unitPriceCents, p.currency)}
            </span>
            <span className="ml-1 text-[11px] font-bold text-catalog-text-muted">
              / {unit}
            </span>
            {hasSpecialPrice ? (
              <span className="mt-1 block text-[10px] font-black text-catalog-green">
                Special price for you
              </span>
            ) : null}
          </div>
        </div>

        {hint && !out ? (
          <div className="rounded-lg border border-catalog-green/20 bg-catalog-green-muted/40 p-3">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-black uppercase tracking-wide text-catalog-text-muted">
                Bulk tier
              </span>
              <span className="font-black text-catalog-green">
                {hint.price}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1 text-[11px] leading-snug text-catalog-text-muted">
              <span>{hint.label}</span>
              <span aria-hidden>&middot;</span>
              <span>{hint.detail}</span>
            </div>
          </div>
        ) : null}

        {out ? (
          <div className="mt-auto flex min-h-11 items-center justify-center rounded-lg border border-catalog-border/50 bg-catalog-input p-2">
            <span className="text-[10px] font-medium text-catalog-text-muted">
              Notify When Available
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "mt-auto flex min-h-11 items-center justify-between rounded-lg border p-1",
              qty > 0
                ? "border-catalog-green/30 bg-catalog-green-muted/50"
                : "border-catalog-border/50 bg-catalog-input",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                qty > 0
                  ? "text-catalog-green hover:bg-catalog-green/10"
                  : "text-catalog-text-muted hover:text-catalog-text",
              )}
              aria-label="Decrease quantity"
              disabled={qty <= 0}
              onClick={(e) => onAdjust(-1, e)}
            >
              <MinusIcon className="h-2.5 w-2.5" />
            </button>
            <span
              className={cn(
                "min-w-8 text-center text-sm font-black",
                qty > 0 ? "font-bold text-catalog-green" : "text-catalog-text",
              )}
            >
              {qty}
            </span>
            <button
              type="button"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border shadow-sm transition-colors",
                qty > 0
                  ? "border-transparent bg-catalog-green text-white"
                  : "border-catalog-border/50 bg-white text-catalog-text",
              )}
              aria-label="Increase quantity"
              onClick={(e) => onAdjust(1, e)}
            >
              <PlusIcon className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BarcodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2 4h2v16H2V4zm4 0h1v16H6V4zm3 0h3v16H9V4zm5 0h1v16h-1V4zm3 0h2v16h-2V4zm4 0h1v16h-1V4z" />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M9 8h6M15 16h6" />
    </svg>
  );
}

function RotateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}
