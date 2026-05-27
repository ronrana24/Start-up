"use client";

import {
  activeTierIndex,
  pricePerCaseCents,
  productBulkTiersSorted,
  productGalleryUrls,
  productHasSpecialPrice,
  subtotalCentsForCases,
} from "@domain/product-pricing";
import type { BulkTier, Product } from "@domain/product";
import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { Chip } from "@presentation/components/ui/chip";
import {
  IconBookmark,
  IconCartPlus,
  IconCheckCircle,
  IconInfo,
  IconLeaf,
  IconMinus,
  IconPlus,
  IconShare,
  IconStar,
  IconTags,
  IconTruck,
} from "@presentation/features/product-detail/pdp-icons";
import { DesktopCartPill } from "@presentation/components/shop/desktop-cart-pill";
import { MobilePageHeader } from "@presentation/components/shop/mobile-page-header";
import { useProductQuery } from "@presentation/hooks/use-product-query";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { cn } from "@presentation/lib/cn";
import { formatMoney } from "@presentation/lib/format-money";
import { productPath } from "@presentation/lib/product-url";
import { useCartStore } from "@presentation/state/cart-store";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/** How long each image stays visible before the next one fades in. */
const HERO_AUTO_ROTATE_INTERVAL_MS = 4500;

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

function savingsPercentFromLabel(label?: string | null): number | null {
  const match = label?.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function tierSavingsPercent(
  referencePriceCents: number,
  tierPriceCents: number,
  savingsLabel?: string | null,
) {
  const labelledSavings = savingsPercentFromLabel(savingsLabel);
  if (referencePriceCents <= 0 || tierPriceCents >= referencePriceCents) {
    return labelledSavings ?? 0;
  }
  const calculatedSavings = Math.round(
    ((referencePriceCents - tierPriceCents) / referencePriceCents) * 100,
  );
  return Math.max(calculatedSavings, labelledSavings ?? 0);
}

function ProductDetailContent({
  data,
  catalog,
}: {
  data: Product;
  catalog: Product[] | undefined;
}) {
  const upsertProductLine = useCartStore((s) => s.upsertProductLine);
  const addProduct = useCartStore((s) => s.addProduct);
  const cartLine = useCartStore(
    (s) => s.lines.find((line) => line.productId === data.id) ?? null,
  );

  const [imageIndex, setImageIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const moq = data.moqCases ?? 1;
  const allPresets = data.quickCasePresets ?? [1, 5, 10];

  // Stock cap: the buyer can never add more than the total quantity currently
  // available across all inventory batches for this product.
  const totalAvailableQty = data.totalAvailableQty ?? 0;
  const hasStockSignal = data.totalAvailableQty !== undefined;
  const isOutOfStock = hasStockSignal
    ? totalAvailableQty <= 0
    : data.inStock === false;
  // When stock metadata isn't surfaced (e.g. legacy mock products) fall back
  // to the historical 999 cap so we don't gate purchase unnecessarily.
  const stockCap = hasStockSignal ? totalAvailableQty : 999;
  // Even with stock available the product may be unorderable if its MOQ is
  // above what we have on hand.
  const moqExceedsStock = stockCap > 0 && moq > stockCap;
  const isPurchasable = !isOutOfStock && !moqExceedsStock;

  const presets = useMemo(() => {
    const upperBound = isPurchasable ? stockCap : 0;
    return allPresets.filter((value) => value >= moq && value <= upperBound);
  }, [allPresets, moq, stockCap, isPurchasable]);
  const [cases, setCases] = useState(() => initialCaseCount(data));

  // Keep the local case count in sync when stock or MOQ changes (e.g. the
  // catalog refetches after another buyer purchased some units).
  useEffect(() => {
    if (!isPurchasable) {
      setCases(0);
      return;
    }
    setCases((current) =>
      Math.max(moq, Math.min(stockCap, current || moq)),
    );
  }, [stockCap, moq, isPurchasable]);

  const selectedCases = isPurchasable
    ? cartLine
      ? Math.max(moq, Math.min(stockCap, Math.floor(cartLine.quantity)))
      : Math.max(moq, Math.min(stockCap, cases || moq))
    : 0;
  const atMaxStock = isPurchasable && selectedCases >= stockCap;
  const atMinMoq = isPurchasable && selectedCases <= moq;

  const related = useMemo(() => {
    if (!data.relatedProductIds?.length || !catalog) return [];
    const set = new Set(data.relatedProductIds);
    return catalog.filter((p) => set.has(p.id));
  }, [catalog, data.relatedProductIds]);

  const gallery = productGalleryUrls(data);
  const hero = gallery[imageIndex] ?? data.imageUrl;
  const galleryLength = gallery.length;
  const activeHeroIndex = galleryLength > 0 ? imageIndex % galleryLength : 0;

  // Cross-fade auto-rotate. Re-running whenever `imageIndex` changes resets
  // the timer naturally on manual thumbnail clicks, keeping the spacing
  // between images consistent across desktop, tablet, and mobile.
  useEffect(() => {
    if (galleryLength <= 1) return;
    if (isHeroPaused) return;
    if (typeof window === "undefined") return;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (prefersReducedMotion) return;
    const timer = window.setTimeout(() => {
      setImageIndex((current) =>
        galleryLength > 0 ? (current + 1) % galleryLength : 0,
      );
    }, HERO_AUTO_ROTATE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [galleryLength, imageIndex, isHeroPaused]);

  // Pause the rotate while the tab is backgrounded so coming back doesn't
  // immediately flash through every image.
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onVisibilityChange() {
      setIsHeroPaused(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
  const tiers = productBulkTiersSorted(data);
  const activeIdx = activeTierIndex(data, selectedCases);
  const unitPrice = pricePerCaseCents(data, selectedCases);
  const subtotal = subtotalCentsForCases(data, selectedCases);
  const unitLabel = data.unitLabel ?? "unit";
  const hasSpecialPrice = productHasSpecialPrice(data);
  const referenceUnitPrice = Math.max(
    data.basePriceCents ?? 0,
    data.priceCents,
    ...tiers.map((tier) => tier.priceCents),
  );
  const tierSavingsPercents = tiers.map((tier) =>
    tierSavingsPercent(referenceUnitPrice, tier.priceCents, tier.savingsLabel),
  );
  const bestSavingsPercent = Math.max(0, ...tierSavingsPercents);
  const activeSavingsPercent =
    activeIdx == null ? 0 : (tierSavingsPercents[activeIdx] ?? 0);

  function clampCases(n: number): number {
    if (!isPurchasable) return 0;
    const requested = Number.isFinite(n) ? Math.floor(n) : moq;
    return Math.max(moq, Math.min(stockCap, requested));
  }

  function setSyncedCases(n: number) {
    if (!isPurchasable) return;
    const next = clampCases(n);
    setCases(next);
    if (cartLine) {
      upsertProductLine(data, next, pricePerCaseCents(data, next));
    }
  }

  function adjustCases(delta: number) {
    setSyncedCases(selectedCases + delta);
  }

  function handleAddToCart() {
    if (!isPurchasable) return;
    upsertProductLine(data, selectedCases, unitPrice);
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

  const showQuantityControls = tiers.length > 0;

  return (
    <div className="relative flex flex-col pb-36 lg:pb-10">
      <MobilePageHeader
        title="Product details"
        fallbackHref="/catalog"
        containerClassName="-mx-4 border-b border-default/60 bg-page px-4 py-3 sm:mx-0 sm:rounded-t-xl"
        rightAction={
          <button
            type="button"
            onClick={() => void shareProduct()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-catalog-text transition-colors hover:bg-black/5"
            aria-label="Share"
          >
            <IconShare className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex flex-col gap-0 pt-2">
        <section className="-mx-4 overflow-hidden border-b border-default/60 bg-card sm:mx-0 sm:rounded-b-xl sm:border sm:border-t-0">
          <div
            className="relative h-[280px] overflow-hidden bg-input-bg"
            onMouseEnter={() => setIsHeroPaused(true)}
            onMouseLeave={() => setIsHeroPaused(false)}
            onTouchStart={() => setIsHeroPaused(true)}
            onTouchEnd={() => setIsHeroPaused(false)}
            onTouchCancel={() => setIsHeroPaused(false)}
            aria-roledescription="carousel"
            aria-label={`${data.title} product images`}
          >
            {galleryLength > 0 ? (
              gallery.map((src, i) => {
                const isActive = i === activeHeroIndex;
                return (
                  <div
                    key={`${src}-${i}`}
                    aria-hidden={!isActive}
                    className={cn(
                      "absolute inset-0 flex items-center justify-center p-6",
                      "transition-[opacity,transform] duration-700 ease-in-out motion-reduce:transition-none",
                      isActive
                        ? "opacity-100 scale-100"
                        : "pointer-events-none opacity-0 scale-[0.97]",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={
                        isActive
                          ? `${data.title} product image ${i + 1}`
                          : ""
                      }
                      draggable={false}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  </div>
                );
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero}
                  alt={`${data.title} product image`}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain"
                />
              </div>
            )}
            {galleryLength > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
                {gallery.map((src, i) => (
                  <span
                    key={`dot-${src}-${i}`}
                    aria-hidden
                    className={cn(
                      "h-1.5 rounded-full bg-default/40 transition-[width,background-color] duration-500 ease-in-out motion-reduce:transition-none",
                      i === activeHeroIndex
                        ? "w-5 bg-primary"
                        : "w-1.5",
                    )}
                  />
                ))}
              </div>
            ) : null}
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
                  aria-current={i === activeHeroIndex ? "true" : undefined}
                  aria-label={`Show image ${i + 1} of ${gallery.length}`}
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-input-bg p-1",
                    "transition-[opacity,transform,border-color,box-shadow] duration-500 ease-in-out motion-reduce:transition-none",
                    i === activeHeroIndex
                      ? "scale-105 border-primary opacity-100 ring-2 ring-primary/20"
                      : "scale-100 border-default opacity-70 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${data.title} product image ${i + 1}`}
                    draggable={false}
                    className="h-full w-full select-none object-contain"
                  />
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
            {isOutOfStock ? (
              <span className="text-xs font-semibold text-red-600">
                Out of stock
              </span>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  hasStockSignal && stockCap <= 5
                    ? "text-amber-700"
                    : "text-primary",
                )}
              >
                <IconCheckCircle />
                {hasStockSignal
                  ? stockCap <= 5
                    ? `Only ${stockCap} left`
                    : `In stock · ${stockCap} available`
                  : "In stock"}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {hasSpecialPrice && data.specialPricing?.originalPriceCents ? (
              <span className="mb-1 text-sm font-semibold text-muted line-through">
                {formatMoney(
                  data.specialPricing.originalPriceCents,
                  data.currency,
                )}
              </span>
            ) : null}
            <span className="text-2xl font-bold text-heading">
              {formatMoney(unitPrice, data.currency)}
            </span>
            {data.unitLabel ? (
              <span className="mb-1 text-sm font-medium text-muted">
                / {data.unitLabel}
              </span>
            ) : null}
          </div>
          {hasSpecialPrice ? (
            <div className="inline-flex w-fit rounded-full border border-primary/20 bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary">
              Special price for you
            </div>
          ) : null}
          {data.hasMultipleBatches ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
              Price may vary based on available inventory batches. Larger
              quantities may pull from multiple batches at different prices.
            </p>
          ) : null}
          {data.packSizeNote ? (
            <p className="text-xs text-muted">{data.packSizeNote}</p>
          ) : null}
          {!showQuantityControls ? (
            <p className="text-sm leading-relaxed text-secondary">
              {data.description}
            </p>
          ) : null}
        </section>

        {showQuantityControls ? (
          <section
            id="wholesale-controls"
            className="mt-2 space-y-4 border-y border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60"
          >
            <h2 className="flex items-center gap-2 text-sm font-bold text-heading">
              <IconTags className="h-4 w-4 text-primary" />
              {hasSpecialPrice ? "Special pricing" : "Bulk pricing tiers"}
            </h2>
            {hasSpecialPrice ? (
              <div className="rounded-xl border border-primary/20 bg-primary-light/50 p-3">
                <p className="text-sm font-bold text-heading">
                  {formatMoney(unitPrice, data.currency)} / {unitLabel}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-secondary">
                  Your special price overrides bulk pricing for this product.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm">
                <div className="border-b border-primary/10 bg-primary-light/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-primary">
                        Wholesale advantage
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-snug text-heading">
                        Larger bundles lower your per-{unitLabel} cost and
                        protect your margins.
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl border border-primary/20 bg-card px-3 py-2 text-right shadow-sm">
                      <p className="text-[9px] font-black uppercase tracking-wide text-muted">
                        Best deal
                      </p>
                      <p className="text-sm font-black text-primary">
                        {bestSavingsPercent > 0
                          ? `Save ${bestSavingsPercent}%`
                          : "Best rate"}
                      </p>
                    </div>
                  </div>
                  {activeSavingsPercent > 0 ? (
                    <p className="mt-3 rounded-lg border border-primary/15 bg-card/80 px-3 py-2 text-[11px] font-bold leading-snug text-primary">
                      Your current quantity is already saving{" "}
                      {activeSavingsPercent}% per {unitLabel}.
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-[1.15fr_0.9fr_0.95fr] gap-0 bg-secondary-bg px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  <span>Quantity</span>
                  <span className="text-center">Price / {unitLabel}</span>
                  <span className="text-right">Reward</span>
                </div>
                {tiers.map((t, idx) => {
                  const rowActive = activeIdx === idx;
                  const savingsPercent = tierSavingsPercents[idx] ?? 0;
                  const bestTier =
                    savingsPercent > 0 && savingsPercent === bestSavingsPercent;
                  return (
                    <div
                      key={`${t.minCases}-${t.maxCases ?? "inf"}`}
                      className={cn(
                        "grid grid-cols-[1.15fr_0.9fr_0.95fr] items-center border-t border-default/40 px-3 py-3 text-xs transition-colors",
                        rowActive &&
                          "bg-primary-light/80 ring-1 ring-inset ring-primary/10",
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
                          "flex flex-col items-end gap-1 text-right font-semibold",
                          rowActive ? "text-primary" : "text-muted",
                        )}
                      >
                        {savingsPercent > 0 ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-black",
                              rowActive
                                ? "bg-primary text-white"
                                : "bg-success-bg text-success",
                            )}
                          >
                            Save {savingsPercent}%
                          </span>
                        ) : (
                          <span>Base rate</span>
                        )}
                        {bestTier ? (
                          <span className="text-[9px] font-black uppercase tracking-wide text-primary">
                            Best value
                          </span>
                        ) : t.savingsLabel ? (
                          <span className="text-[9px]">{t.savingsLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                  {hasStockSignal ? ` · Max: ${stockCap}` : ""}
                </span>
              </div>
              <div className="mb-4 flex gap-3">
                <div className="flex flex-1 items-center justify-between rounded-lg border border-default bg-card p-1 shadow-sm">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted transition-opacity hover:bg-secondary-bg hover:text-heading disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
                    onClick={() => adjustCases(-1)}
                    aria-label="Decrease quantity"
                    disabled={!isPurchasable || atMinMoq}
                  >
                    <IconMinus />
                  </button>
                  <input
                    id="case-qty"
                    type="number"
                    min={moq}
                    max={stockCap}
                    value={selectedCases}
                    onChange={(e) =>
                      setSyncedCases(Number(e.target.value) || moq)
                    }
                    disabled={!isPurchasable}
                    className="w-16 border-0 bg-transparent text-center text-lg font-bold text-heading outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary-bg text-heading transition-opacity hover:bg-default/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary-bg"
                    onClick={() => adjustCases(1)}
                    aria-label="Increase quantity"
                    disabled={!isPurchasable || atMaxStock}
                  >
                    <IconPlus />
                  </button>
                </div>
              </div>
              {isPurchasable && atMaxStock ? (
                <p className="-mt-2 mb-3 text-[11px] font-semibold text-amber-700">
                  You&apos;ve reached the maximum available stock ({stockCap}{" "}
                  {unitLabel}
                  {stockCap === 1 ? "" : "s"}).
                </p>
              ) : null}
              {presets.length > 0 ? (
                <div className="mb-4 flex gap-2">
                  {presets.map((p) => (
                    <Chip
                      key={p}
                      type="button"
                      active={selectedCases === p}
                      className="flex-1 rounded-lg py-2 text-xs font-semibold"
                      onClick={() => setSyncedCases(p)}
                      disabled={!isPurchasable}
                    >
                      {p} {unitLabel}
                      {p > 1 ? "s" : ""}
                    </Chip>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-default/60 pt-3 text-sm">
                <span className="font-medium text-muted">Subtotal</span>
                <span className="text-xl font-bold text-heading">
                  {formatMoney(subtotal, data.currency)}
                </span>
              </div>
              <Button
                type="button"
                className="mt-4 gap-2"
                fullWidth
                onClick={handleAddToCart}
                disabled={!isPurchasable}
              >
                <IconCartPlus className="h-4 w-4" />
                {isOutOfStock
                  ? "Out of stock"
                  : moqExceedsStock
                    ? `Only ${stockCap} ${unitLabel}${stockCap === 1 ? "" : "s"} available (MOQ ${moq})`
                    : `${cartLine ? "Update" : "Add"} ${selectedCases} ${unitLabel}${selectedCases === 1 ? "" : "s"} to cart`}
              </Button>
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
              disabled={!isPurchasable}
              onClick={() => {
                if (!isPurchasable) return;
                addProduct(data, 1);
              }}
            >
              {isOutOfStock ? "Out of stock" : "Add to cart"}
            </Button>
          </section>
        )}

        {data.logistics && data.logistics.length > 0 ? (
          <section className="mt-2 space-y-3 border-y border-default/60 bg-card p-4 sm:rounded-xl sm:border sm:border-default/60">
            <h2 className="text-sm font-bold text-heading">
              Logistics and specs
            </h2>
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
                    href={productPath(p)}
                    className="block h-20 w-full overflow-hidden rounded-lg bg-input-bg p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt={`${p.title} product image`}
                      className="h-full w-full object-contain"
                    />
                  </Link>
                  <div>
                    {p.brand ? (
                      <p className="mb-0.5 line-clamp-1 text-[10px] font-medium text-muted">
                        {p.brand}
                      </p>
                    ) : null}
                    <Link href={productPath(p)}>
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

      <DesktopCartPill />
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
        <MobilePageHeader title="Product details" fallbackHref="/catalog" />
        <div className="h-72 animate-pulse rounded-xl bg-secondary-bg" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-secondary-bg" />
        <div className="h-40 animate-pulse rounded bg-secondary-bg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <MobilePageHeader title="Product details" fallbackHref="/catalog" />
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
      </div>
    );
  }

  return <ProductDetailContent key={data.id} data={data} catalog={catalog} />;
}
