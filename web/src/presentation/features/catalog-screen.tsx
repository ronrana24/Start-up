"use client";

import {
  pricePerCaseCents,
  productBulkTiersSorted,
} from "@domain/product-pricing";
import type { Product } from "@domain/product";
import { cartTotalCents } from "@domain/cart";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = "best" | "price-asc" | "price-desc";

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
    /\b(250|500|1000)\s*ct\b/i.test(pack) ||
    /bulk/i.test(pack.toLowerCase())
  );
}

function unitSubtitle(p: Product): string {
  const unit = p.unitLabel ?? "case";
  const note = p.packSizeNote?.trim();
  if (note) return `/ ${unit} (${note})`;
  return `/ ${unit}`;
}

function tierHint(p: Product): { label: string; price: string } | null {
  const tiers = productBulkTiersSorted(p);
  if (!tiers.length) return null;
  const t = tiers[0]!;
  const unit = p.unitLabel ?? "case";
  return {
    label: `${t.minCases}+ ${unit}s`,
    price: `${formatMoney(t.priceCents, p.currency)}/ea`,
  };
}

export function CatalogScreen() {
  const { data: raw, isPending, isError, refetch } = useProductsQuery();
  const lines = useCartStore((s) => s.lines);
  const upsertProductLine = useCartStore((s) => s.upsertProductLine);
  const setQuantity = useCartStore((s) => s.setQuantity);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("best");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ecoOnly, setEcoOnly] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

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

  const quickReorder = useMemo(
    () => filteredSorted.slice(0, 4),
    [filteredSorted],
  );

  const subtotalCents = useMemo(() => cartTotalCents(lines), [lines]);
  const cartCaseCount = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines],
  );

  function toggleSaved(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaved((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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

  function quickAdd(p: Product, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const cur = qtyFor(p.id);
    const moq = p.moqCases ?? 1;
    const next = cur === 0 ? moq : Math.min(999, cur + 1);
    upsertProductLine(p, next, pricePerCaseCents(p, next));
  }

  if (isPending) {
    return (
      <div className="min-h-[50vh] bg-catalog-surface px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
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
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 h-0.5 bg-catalog-green" />

      <div className="sticky top-0 z-40 border-b border-catalog-border/50 bg-catalog-surface pt-6 shadow-sm">
        <header className="mb-4 flex items-center justify-between px-4">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
            aria-label="Menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="text-sm font-semibold tracking-tight text-catalog-text">
            Product Catalog
          </div>
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-catalog-surface bg-catalog-green" />
          </button>
        </header>

        <div className="mb-3 px-4">
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

        <div className="px-4 pb-2">
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
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pb-36">
        {quickReorder.length > 0 ? (
          <section className="pt-4">
            <div className="mb-3 flex items-center justify-between px-4">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-catalog-text">
                <RotateIcon className="h-4 w-4 text-catalog-green" />
                Quick Reorder
              </h2>
              <Link
                href="#all-disposables"
                className="text-xs font-medium text-catalog-blue hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-4">
              {quickReorder.map((p) => (
                <div
                  key={p.id}
                  className="flex w-[140px] shrink-0 flex-col gap-2 rounded-xl border border-catalog-border/50 bg-card p-3 shadow-sm"
                >
                  <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg bg-catalog-input p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-contain mix-blend-multiply"
                    />
                    {p.packSizeNote ? (
                      <span className="absolute right-1 top-1 rounded border border-catalog-border bg-card px-1.5 py-0.5 text-[9px] font-bold text-catalog-text">
                        {p.packSizeNote.replace(/\s+/g, "").slice(0, 8)}
                      </span>
                    ) : null}
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
                    <span className="text-sm font-bold text-catalog-text">
                      {formatMoney(p.priceCents, p.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => quickAdd(p, e)}
                      disabled={p.inStock === false}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-catalog-green-muted text-catalog-green transition-colors hover:bg-catalog-green hover:text-white disabled:opacity-40"
                      aria-label={`Add ${p.title}`}
                    >
                      <PlusIcon className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
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

          <div className="grid grid-cols-2 gap-3">
            {filteredSorted.map((p) => (
              <CatalogProductCard
                key={p.id}
                product={p}
                qty={qtyFor(p.id)}
                saved={!!saved[p.id]}
                onToggleSaved={(e) => toggleSaved(p.id, e)}
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

      {lines.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 z-30 mb-2 px-4 max-lg:bottom-[calc(3.75rem+env(safe-area-inset-bottom))] lg:bottom-6">
          <div className="pointer-events-auto mx-auto max-w-lg">
            <div className="flex items-center justify-between rounded-2xl border border-catalog-blue-light/20 bg-catalog-blue p-3 shadow-[var(--shadow-catalog-cart)]">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <CartIcon className="h-4 w-4 text-white" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-catalog-blue bg-catalog-green text-[9px] font-bold text-white">
                    {cartCaseCount > 99 ? "99+" : cartCaseCount}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">
                    Subtotal
                  </p>
                  <p className="text-sm font-bold text-white">
                    {formatMoney(subtotalCents, "USD")}
                  </p>
                </div>
              </div>
              <Link
                href="/cart"
                className="flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-xs font-bold text-catalog-blue transition-colors hover:bg-catalog-surface"
              >
                View Cart
                <ArrowRightIcon className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CatalogProductCard({
  product: p,
  qty,
  saved,
  onToggleSaved,
  onAdjust,
}: {
  product: Product;
  qty: number;
  saved: boolean;
  onToggleSaved: (e: React.MouseEvent) => void;
  onAdjust: (delta: number, e: React.MouseEvent) => void;
}) {
  const out = p.inStock === false;
  const hint = tierHint(p);
  const badges = p.badges ?? [];

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-catalog-border/50 bg-card shadow-sm",
        out && "opacity-75",
      )}
    >
      <Link href={`/products/${p.id}`} className="relative block">
        <div
          className={cn(
            "relative flex h-[120px] items-center justify-center bg-catalog-input p-3",
            out && "grayscale",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.imageUrl}
            alt=""
            className="h-full w-full object-contain mix-blend-multiply"
          />
          {out ? (
            <div className="absolute inset-0 flex items-center justify-center bg-catalog-surface/40 backdrop-blur-[1px]">
              <span className="rounded bg-catalog-text px-2 py-1 text-[10px] font-bold text-white">
                Out of Stock
              </span>
            </div>
          ) : (
            <>
              {badges.length > 0 ? (
                <div className="absolute left-2 top-2 flex flex-col gap-1">
                  {badges.slice(0, 2).map((b) => (
                    <span
                      key={b.label}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
                        b.tone === "accent"
                          ? "bg-catalog-blue"
                          : "bg-catalog-green",
                      )}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={onToggleSaved}
                className={cn(
                  "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-colors",
                  saved ? "text-catalog-blue" : "text-catalog-text-muted hover:text-catalog-blue",
                )}
                aria-label={saved ? "Remove save" : "Save item"}
              >
                <BookmarkIcon className="h-2.5 w-2.5" filled={saved} />
              </button>
            </>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-catalog-text-muted">
          {p.brand ?? "—"}
        </p>
        <Link href={`/products/${p.id}`}>
          <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-catalog-text">
            {p.title}
          </h3>
        </Link>

        <div className="mt-1 flex items-end justify-between">
          <div>
            <span className="text-sm font-bold text-catalog-text">
              {formatMoney(
                pricePerCaseCents(
                  p,
                  qty > 0 ? qty : (p.moqCases ?? 1),
                ),
                p.currency,
              )}
            </span>
            <span className="block text-[9px] text-catalog-text-muted">
              {unitSubtitle(p)}
            </span>
          </div>
        </div>

        {hint && !out ? (
          <div className="mt-1 rounded border border-catalog-border/30 bg-catalog-surface p-1.5">
            <div className="flex justify-between text-[9px] text-catalog-text-muted">
              <span>{hint.label}</span>
              <span className="font-medium text-catalog-green">{hint.price}</span>
            </div>
          </div>
        ) : null}

        {out ? (
          <div className="mt-auto flex items-center justify-center rounded-lg border border-catalog-border/50 bg-catalog-input p-2">
            <span className="text-[10px] font-medium text-catalog-text-muted">
              Notify When Available
            </span>
          </div>
        ) : (
          <div
            className={cn(
              "mt-auto flex items-center justify-between rounded-lg border p-1",
              qty > 0
                ? "border-catalog-green/30 bg-catalog-green-muted/50"
                : "border-catalog-border/50 bg-catalog-input",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
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
                "w-6 text-center text-xs font-semibold",
                qty > 0 ? "font-bold text-catalog-green" : "text-catalog-text",
              )}
            >
              {qty}
            </span>
            <button
              type="button"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-colors",
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
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
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
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function BookmarkIcon({
  className,
  filled,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}
