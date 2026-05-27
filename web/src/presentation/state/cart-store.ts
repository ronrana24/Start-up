"use client";

import { previewBatchBreakdown, type CartLine } from "@domain/cart";
import type { InventoryBatchSummary, Product } from "@domain/product";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartProductMeta = {
  batches: InventoryBatchSummary[];
  hasMultipleBatches: boolean;
  /**
   * Total units available across all inventory batches when this product
   * was last added/edited. `undefined` means the API didn't report a cap
   * (legacy/mock data); the store treats `undefined` as "no upper bound".
   */
  maxAvailableQty?: number;
};

type CartState = {
  lines: CartLine[];
  /** Most recent batch snapshot per product, captured when added/edited. */
  productMeta: Record<string, CartProductMeta>;
  addProduct: (product: Product, quantity?: number) => void;
  /** Sets exact quantity and unit price for a line (e.g. wholesale PDP). */
  upsertProductLine: (
    product: Product,
    quantity: number,
    unitPriceCents: number,
  ) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
};

function captureProductMeta(product: Product): CartProductMeta {
  return {
    batches: product.batches ?? [],
    hasMultipleBatches: product.hasMultipleBatches ?? false,
    maxAvailableQty: product.totalAvailableQty,
  };
}

/**
 * Apply the stock ceiling stored on `meta` to a requested quantity. When the
 * cap is unknown (e.g. legacy mock products) we leave the value untouched.
 */
function clampToStock(
  quantity: number,
  meta: CartProductMeta | undefined,
): number {
  if (!meta || meta.maxAvailableQty == null) return quantity;
  return Math.max(0, Math.min(meta.maxAvailableQty, quantity));
}

function withBatchBreakdown(
  line: CartLine,
  meta: CartProductMeta | undefined,
): CartLine {
  const withCap: CartLine = {
    ...line,
    maxAvailableQty: meta?.maxAvailableQty,
  };
  if (!meta || meta.batches.length === 0) {
    return withCap;
  }
  const segments = previewBatchBreakdown(meta.batches, withCap.quantity);
  if (segments.length === 0) return withCap;
  return {
    ...withCap,
    batchBreakdown: segments,
    hasMixedBatches: segments.length > 1,
  };
}

function upsert(
  lines: CartLine[],
  product: Product,
  quantity: number,
  meta: CartProductMeta,
): CartLine[] {
  const idx = lines.findIndex((l) => l.productId === product.id);
  const baseLine: CartLine = {
    productId: product.id,
    quantity,
    title: product.title,
    unitPriceCents: product.priceCents,
    currency: product.currency,
    pricingSource: product.pricingSource,
    originalUnitPriceCents: product.specialPricing?.originalPriceCents ?? null,
    specialPricingLabel: product.specialPricing?.label ?? null,
    imageUrl: product.imageUrl,
  };
  const line = withBatchBreakdown(baseLine, meta);
  if (idx === -1) {
    return [...lines, line];
  }
  const next = lines.slice();
  next[idx] = { ...next[idx], ...line };
  return next;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      productMeta: {},
      addProduct: (product, quantity = 1) => {
        const existing = get().lines.find((l) => l.productId === product.id);
        const meta = captureProductMeta(product);
        // Refuse to push the line past the live stock cap. If the cap is 0
        // (out of stock) we silently drop the request rather than create a
        // zero-quantity line.
        const requested = (existing?.quantity ?? 0) + Math.max(0, quantity);
        const nextQty = clampToStock(requested, meta);
        if (nextQty <= 0) {
          return;
        }
        set({
          lines: upsert(get().lines, product, nextQty, meta),
          productMeta: { ...get().productMeta, [product.id]: meta },
        });
      },
      upsertProductLine: (product, quantity, unitPriceCents) => {
        if (quantity <= 0) {
          const nextMeta = { ...get().productMeta };
          delete nextMeta[product.id];
          set({
            lines: get().lines.filter((l) => l.productId !== product.id),
            productMeta: nextMeta,
          });
          return;
        }
        const meta = captureProductMeta(product);
        const cappedQty = clampToStock(quantity, meta);
        if (cappedQty <= 0) {
          // Out of stock — treat as removal.
          const nextMeta = { ...get().productMeta };
          delete nextMeta[product.id];
          set({
            lines: get().lines.filter((l) => l.productId !== product.id),
            productMeta: nextMeta,
          });
          return;
        }
        const baseLine: CartLine = {
          productId: product.id,
          quantity: cappedQty,
          title: product.title,
          unitPriceCents,
          currency: product.currency,
          pricingSource: product.pricingSource,
          originalUnitPriceCents:
            product.specialPricing?.originalPriceCents ?? null,
          specialPricingLabel: product.specialPricing?.label ?? null,
          imageUrl: product.imageUrl,
        };
        const line = withBatchBreakdown(baseLine, meta);
        const idx = get().lines.findIndex((l) => l.productId === product.id);
        const next = get().lines.slice();
        if (idx === -1) {
          next.push(line);
        } else {
          next[idx] = line;
        }
        set({
          lines: next,
          productMeta: { ...get().productMeta, [product.id]: meta },
        });
      },
      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          const nextMeta = { ...get().productMeta };
          delete nextMeta[productId];
          set({
            lines: get().lines.filter((l) => l.productId !== productId),
            productMeta: nextMeta,
          });
          return;
        }
        const meta = get().productMeta[productId];
        const cappedQty = clampToStock(quantity, meta);
        if (cappedQty <= 0) {
          const nextMeta = { ...get().productMeta };
          delete nextMeta[productId];
          set({
            lines: get().lines.filter((l) => l.productId !== productId),
            productMeta: nextMeta,
          });
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.productId === productId
              ? withBatchBreakdown({ ...l, quantity: cappedQty }, meta)
              : l,
          ),
        });
      },
      removeLine: (productId) => {
        const nextMeta = { ...get().productMeta };
        delete nextMeta[productId];
        set({
          lines: get().lines.filter((l) => l.productId !== productId),
          productMeta: nextMeta,
        });
      },
      clear: () => set({ lines: [], productMeta: {} }),
    }),
    { name: "shop-cart" },
  ),
);
