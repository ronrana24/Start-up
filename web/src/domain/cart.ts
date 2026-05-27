import type { InventoryBatchSummary, ProductId } from "@domain/product";

export type CartLineBatchSegment = {
  batchId: string;
  batchNumber: number;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type CartLine = {
  productId: ProductId;
  quantity: number;
  title: string;
  unitPriceCents: number;
  currency?: "USD" | "INR";
  pricingSource?: "BATCH" | "SPECIAL";
  originalUnitPriceCents?: number | null;
  specialPricingLabel?: string | null;
  imageUrl: string;
  /** Most recent server quote: split pricing across inventory batches. */
  batchBreakdown?: CartLineBatchSegment[];
  hasMixedBatches?: boolean;
  /**
   * Total units available across all inventory batches at the moment this
   * line was last refreshed. Used by the cart/catalog `+` buttons to clamp
   * the quantity. `undefined` means stock metadata wasn't available
   * (legacy/mock data) — callers should treat that as "no cap known".
   */
  maxAvailableQty?: number;
};

export function cartLineTotalCents(line: CartLine): number {
  if (line.batchBreakdown && line.batchBreakdown.length > 0) {
    return line.batchBreakdown.reduce(
      (sum, seg) => sum + seg.lineTotalCents,
      0,
    );
  }
  return line.unitPriceCents * line.quantity;
}

export function cartTotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + cartLineTotalCents(line), 0);
}

/**
 * Pick the unit price (in cents) for a single batch given a total line
 * quantity. Mirrors the backend's per-batch tier resolution: highest
 * matching `minCases` wins, fall back to the batch's selling price.
 */
function batchUnitPriceCents(
  batch: InventoryBatchSummary,
  totalLineQty: number,
): number {
  const tiers = batch.bulkTiers ?? [];
  if (tiers.length === 0) return batch.sellingPriceCents;
  const sorted = [...tiers].sort((a, b) => b.minCases - a.minCases);
  for (const tier of sorted) {
    if (totalLineQty >= tier.minCases) {
      return tier.priceCents;
    }
  }
  return batch.sellingPriceCents;
}

/**
 * Local FIFO preview of how a `quantity` would split across the given
 * inventory batches. Used to render mixed pricing in the cart without
 * needing to round-trip to the server for every quantity change. The
 * server quote on checkout is still the source of truth.
 */
export function previewBatchBreakdown(
  batches: InventoryBatchSummary[],
  quantity: number,
): CartLineBatchSegment[] {
  if (quantity <= 0 || batches.length === 0) return [];
  const sorted = [...batches].sort((a, b) => a.batchNumber - b.batchNumber);
  let remaining = quantity;
  const segments: CartLineBatchSegment[] = [];
  for (const batch of sorted) {
    if (remaining <= 0) break;
    if (batch.remainingQty <= 0) continue;
    const take = Math.min(remaining, batch.remainingQty);
    const unitPriceCents = batchUnitPriceCents(batch, quantity);
    segments.push({
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      quantity: take,
      unitPriceCents,
      lineTotalCents: unitPriceCents * take,
    });
    remaining -= take;
  }
  return segments;
}
