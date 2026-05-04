"use client";

import {
  activeTierIndex,
  pricePerCaseCents,
  productBulkTiersSorted,
  productGalleryUrls,
  subtotalCentsForCases,
} from "@domain/product-pricing";
import type { BulkTier, Product } from "@domain/product";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Chip } from "@presentation/components/ui/chip";
import {
  IconArrowLeft,
  IconBookmark,
  IconCartPlus,
  IconCheckCircle,
  IconInfo,
  IconLeaf,
  IconList,
  IconMinus,
  IconPlus,
  IconShare,
  IconStar,
  IconTags,
  IconTruck,
} from "@presentation/features/product-detail/pdp-icons";
import { useProductQuery } from "@presentation/hooks/use-product-query";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function tierQuantityLabel(t: BulkTier): string {
  if (t.maxCases == null) {
    return `${t.minCases}+ cases`;
  }
  return `${t.minCases} – ${t.maxCases} cases`;
}

function initialCaseCount(data: Product): number {
  const moqVal = data.moqCases ?? 1;
  const preset =
    data.quickCasePresets?.find((x) => x >= moqVal) ??
    data.quickCasePresets?.[0] ??
    moqVal;
  return Math.max(moqVal, Math.min(999, preset));
}

function ProductDetailContent({
  data,
  catalog,
}: {
  data: Product;
  catalog: Product[] | undefined;
}) {
  const router = useRouter();
  const upsertProductLine = useCartStore((s) => s.upsertProductLine);
  const addProduct = useCartStore((s) => s.addProduct);

  const [imageIndex, setImageIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const moq = data.moqCases ?? 1;
  const presets = data.quickCasePresets ?? [1, 5, 10];
  const [cases, setCases] = useState(() => initialCaseCount(data));

  const related = useMemo(() => {
    if (!data.relatedProductIds?.length || !catalog) return [];
    const set = new Set(data.relatedProductIds);
    return catalog.filter((p) => set.has(p.id));
  }, [catalog, data.relatedProductIds]);

  const gallery = productGalleryUrls(data);
  const hero = gallery[imageIndex] ?? data.imageUrl;
  const tiers = productBulkTiersSorted(data);
  const activeIdx = activeTierIndex(data, cases);
  const unitPrice = pricePerCaseCents(data, cases);
  const subtotal = subtotalCentsForCases(data, cases);
  const unitLabel = data.unitLabel ?? "unit";

  function clampCases(n: number): number {
    return Math.max(moq, Math.min(999, Math.floor(n)));
  }

  function adjustCases(delta: number) {
    setCases((c) => clampCases(c + delta));
  }

  async function shareProduct() {
    const url =
      typeof window !== "undefined" ? window.location.href : data.title;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled or clipboard blocked */
    }
  }

  const showWholesale = tiers.length > 0;

  return (
    <div className="relative flex flex-col pb-36 lg:pb-10">
      <div className="mb-0 h-1 w-full bg-primary sm:rounded-full" />

      <div className="sticky top-0 z-[15] -mx-4 border-b border-default/60 bg-page/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-t-xl">
        <header className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full text-heading hover:bg-secondary-bg"
            aria-label="Back to catalog"
          >
            <IconArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-sm font-semibold text-heading">
            Product details
          </span>
          <button
            type="button"
            onClick={() => void shareProduct()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-heading hover:bg-secondary-bg"
            aria-label="Share"
          >
            <IconShare className="h-5 w-5" />
          </button>
        </header>
      </div>

      <div className="flex flex-col gap-0 pt-2">
        <section className="-mx-4 overflow-hidden border-b border-default/60 bg-card sm:mx-0 sm:rounded-b-xl sm:border sm:border-t-0">
          <div className="relative flex h-[280px] items-center justify-center bg-input-bg p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
            {data.badges && data.badges.length > 0 ? (
              <div className="absolute left-4 top-4 flex flex-col gap-2">
                {data.badges.map((b) => (
                  <span
                    key={b.label}
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm",
                      b.tone === "accent"
                        ? "bg-secondary-bg text-heading ring-1 ring-default"
                        : "bg-primary text-white",
                    )}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setSaved((s) => !s)}
              className={cn(
                "absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-default",
                saved ? "text-primary" : "text-secondary",
              )}
              aria-label={saved ? "Remove bookmark" : "Bookmark"}
            >
              <IconBookmark className="h-4 w-4" />
            </button>
          </div>
          {gallery.length > 1 ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto p-4">
              {gallery.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-input-bg p-1 transition-opacity",
                    i === imageIndex
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-default opacity-80 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-2 space-y-3 border-b border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60">
          {(data.brand || data.sku) && (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {[data.brand, data.sku].filter(Boolean).join(" • ")}
            </p>
          )}
          <h1 className="text-xl font-bold leading-tight text-heading">
            {data.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {data.rating != null ? (
              <div className="flex items-center gap-1.5 font-medium text-heading">
                <IconStar className="text-primary" />
                <span>{data.rating.toFixed(1)}</span>
                {data.reviewCount != null ? (
                  <span className="text-xs text-muted underline">
                    ({data.reviewCount} reviews)
                  </span>
                ) : null}
              </div>
            ) : null}
            {data.rating != null && data.inStock != null ? (
              <span className="hidden h-1 w-1 rounded-full bg-default sm:inline" />
            ) : null}
            {data.inStock !== false ? (
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <IconCheckCircle />
                In stock
              </div>
            ) : (
              <span className="text-xs font-semibold text-muted">Out of stock</span>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-2xl font-bold text-heading">
              {formatMoney(unitPrice, data.currency)}
            </span>
            {data.unitLabel ? (
              <span className="mb-1 text-sm font-medium text-muted">
                / {data.unitLabel}
              </span>
            ) : null}
          </div>
          {data.packSizeNote ? (
            <p className="text-xs text-muted">{data.packSizeNote}</p>
          ) : null}
          {!showWholesale ? (
            <p className="text-sm leading-relaxed text-secondary">
              {data.description}
            </p>
          ) : null}
        </section>

        {showWholesale ? (
          <section
            id="wholesale-controls"
            className="mt-2 space-y-4 border-y border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold text-heading">
              <IconTags className="h-4 w-4 text-primary" />
              Bulk pricing tiers
            </h2>
            <div className="overflow-hidden rounded-xl border border-default/60">
              <div className="grid grid-cols-3 gap-0 bg-secondary-bg px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                <span>Quantity</span>
                <span className="text-center">Price / case</span>
                <span className="text-right">Savings</span>
              </div>
              {tiers.map((t, idx) => {
                const rowActive = activeIdx === idx;
                return (
                  <div
                    key={`${t.minCases}-${t.maxCases ?? "inf"}`}
                    className={cn(
                      "grid grid-cols-3 items-center border-t border-default/40 px-3 py-3 text-xs",
                      rowActive && "bg-primary-light/80",
                    )}
                  >
                    <div
                      className={cn(
                        "font-semibold",
                        rowActive ? "text-primary" : "text-heading",
                      )}
                    >
                      {tierQuantityLabel(t)}
                      {rowActive ? (
                        <IconCheckCircle className="ml-1 inline align-middle text-primary" />
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "text-center font-bold",
                        rowActive ? "text-primary" : "text-heading",
                      )}
                    >
                      {formatMoney(t.priceCents, data.currency)}
                    </div>
                    <div
                      className={cn(
                        "text-right font-semibold",
                        rowActive ? "text-primary" : "text-muted",
                      )}
                    >
                      {t.savingsLabel ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-default/60 bg-page p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <label
                  htmlFor="case-qty"
                  className="text-sm font-bold text-heading"
                >
                  Quantity ({unitLabel}s)
                </label>
                <span className="text-xs font-medium text-muted">
                  MOQ: {moq} {unitLabel}
                </span>
              </div>
              <div className="mb-4 flex gap-3">
                <div className="flex flex-1 items-center justify-between rounded-lg border border-default bg-card p-1 shadow-sm">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-secondary-bg hover:text-heading"
                    onClick={() => adjustCases(-1)}
                    aria-label="Decrease quantity"
                  >
                    <IconMinus />
                  </button>
                  <input
                    id="case-qty"
                    type="number"
                    min={moq}
                    max={999}
                    value={cases}
                    onChange={(e) =>
                      setCases(clampCases(Number(e.target.value) || moq))
                    }
                    className="w-16 border-0 bg-transparent text-center text-lg font-bold text-heading outline-none"
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary-bg text-heading hover:bg-default/60"
                    onClick={() => adjustCases(1)}
                    aria-label="Increase quantity"
                  >
                    <IconPlus />
                  </button>
                </div>
              </div>
              <div className="mb-4 flex gap-2">
                {presets.map((p) => (
                  <Chip
                    key={p}
                    type="button"
                    active={cases === p}
                    className="flex-1 rounded-lg py-2 text-xs font-semibold"
                    onClick={() => setCases(clampCases(p))}
                  >
                    {p} {unitLabel}
                    {p > 1 ? "s" : ""}
                  </Chip>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-default/60 pt-3 text-sm">
                <span className="font-medium text-muted">Subtotal</span>
                <span className="text-xl font-bold text-heading">
                  {formatMoney(subtotal, data.currency)}
                </span>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-2 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60">
            <p className="text-sm leading-relaxed text-secondary">
              {data.description}
            </p>
            <Button
              type="button"
              className="mt-4"
              fullWidth
              onClick={() => addProduct(data, 1)}
            >
              Add to cart
            </Button>
          </section>
        )}

        {data.logistics && data.logistics.length > 0 ? (
          <section className="mt-2 space-y-3 border-y border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60">
            <h2 className="text-sm font-bold text-heading">Logistics and specs</h2>
            <div className="grid grid-cols-2 gap-3">
              {data.logistics.map((row, i) => (
                <div
                  key={`${row.label}-${i}`}
                  className="rounded-lg border border-default/40 bg-secondary-bg p-3"
                >
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                    {row.label}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-bold text-heading">
                    {row.label.toLowerCase().includes("lead") ? (
                      <IconTruck className="shrink-0 text-primary" />
                    ) : null}
                    {row.label.toLowerCase().includes("material") ? (
                      <IconLeaf className="shrink-0 text-primary" />
                    ) : null}
                    {row.value}
                  </p>
                </div>
              ))}
            </div>
            {data.substitutionNote ? (
              <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary-light/40 p-3">
                <IconInfo className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-heading">
                    Substitutions policy
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
                    {data.substitutionNote}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="pb-4 pt-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-heading">
                Frequently bought together
              </h2>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
              {related.map((p: Product) => (
                <div
                  key={p.id}
                  className="flex w-[140px] shrink-0 flex-col gap-2 rounded-xl border border-default/60 bg-card p-3 shadow-sm"
                >
                  <Link
                    href={`/products/${p.id}`}
                    className="block h-20 w-full overflow-hidden rounded-lg bg-input-bg p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </Link>
                  <div>
                    {p.brand ? (
                      <p className="mb-0.5 line-clamp-1 text-[10px] font-medium text-muted">
                        {p.brand}
                      </p>
                    ) : null}
                    <Link href={`/products/${p.id}`}>
                      <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-heading">
                        {p.title}
                      </h3>
                    </Link>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-sm font-bold text-heading">
                      {formatMoney(p.priceCents, p.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addProduct(p, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary hover:bg-primary hover:text-white"
                      aria-label={`Add ${p.title}`}
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {showWholesale ? (
        <div
          className={cn(
            "fixed left-0 right-0 z-20 border-t border-default bg-card px-3 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.06)]",
            "max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-6",
          )}
        >
          <div className="mx-auto flex max-w-lg gap-2 lg:max-w-3xl">
            <Link
              href="/cart"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-default text-primary hover:bg-secondary-bg"
              aria-label="View cart"
            >
              <IconList className="h-5 w-5" />
            </Link>
            <Button
              type="button"
              className="flex-1 gap-2"
              onClick={() => {
                upsertProductLine(data, cases, unitPrice);
                router.push("/cart");
              }}
            >
              <IconCartPlus className="h-4 w-4" />
              Add {cases} {unitLabel}
              {cases === 1 ? "" : "s"} to cart
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProductDetailScreen() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, isPending, isError, refetch } = useProductQuery(id);
  const { data: catalog } = useProductsQuery();

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-xl bg-secondary-bg" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-secondary-bg" />
        <div className="h-40 animate-pulse rounded bg-secondary-bg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <p className="text-secondary">Product not found.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/" className="text-sm font-semibold text-primary">
            Back to shop
          </Link>
          <button
            type="button"
            className="text-sm font-semibold text-secondary"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <ProductDetailContent key={data.id} data={data} catalog={catalog} />
  );
}
