"use client";

import type { CartLine } from "@domain/cart";
import type { Product } from "@domain/product";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartState = {
  lines: CartLine[];
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

function upsert(lines: CartLine[], product: Product, quantity: number): CartLine[] {
  const idx = lines.findIndex((l) => l.productId === product.id);
  const line: CartLine = {
    productId: product.id,
    quantity,
    title: product.title,
    unitPriceCents: product.priceCents,
    imageUrl: product.imageUrl,
  };
  if (idx === -1) {
    return [...lines, line];
  }
  const next = lines.slice();
  next[idx] = { ...next[idx], quantity };
  return next;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addProduct: (product, quantity = 1) => {
        const existing = get().lines.find((l) => l.productId === product.id);
        const nextQty = (existing?.quantity ?? 0) + quantity;
        set({ lines: upsert(get().lines, product, nextQty) });
      },
      upsertProductLine: (product, quantity, unitPriceCents) => {
        if (quantity <= 0) {
          set({
            lines: get().lines.filter((l) => l.productId !== product.id),
          });
          return;
        }
        const line: CartLine = {
          productId: product.id,
          quantity,
          title: product.title,
          unitPriceCents,
          imageUrl: product.imageUrl,
        };
        const idx = get().lines.findIndex((l) => l.productId === product.id);
        const next = get().lines.slice();
        if (idx === -1) {
          next.push(line);
        } else {
          next[idx] = line;
        }
        set({ lines: next });
      },
      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          set({
            lines: get().lines.filter((l) => l.productId !== productId),
          });
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.productId === productId ? { ...l, quantity } : l,
          ),
        });
      },
      removeLine: (productId) =>
        set({ lines: get().lines.filter((l) => l.productId !== productId) }),
      clear: () => set({ lines: [] }),
    }),
    { name: "shop-cart" },
  ),
);
