import type { BulkTier, Product } from "@domain/product";

export function productBulkTiersSorted(product: Product): BulkTier[] {
  const tiers = product.bulkTiers ?? [];
  return [...tiers].sort((a, b) => a.minCases - b.minCases);
}

function sortedTiers(product: Product): BulkTier[] {
  return productBulkTiersSorted(product);
}

export function productGalleryUrls(product: Product): string[] {
  const extra = product.galleryImageUrls?.filter(Boolean) ?? [];
  if (extra.length > 0) {
    const seen = new Set<string>();
    const merged = [product.imageUrl, ...extra].filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
    return merged;
  }
  return [product.imageUrl];
}

export function pricePerCaseCents(product: Product, cases: number): number {
  const tiers = sortedTiers(product);
  if (tiers.length === 0) {
    return product.priceCents;
  }
  const safe = Math.max(product.moqCases ?? 1, cases);
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i]!;
    const maxOk = t.maxCases == null || safe <= t.maxCases;
    if (safe >= t.minCases && maxOk) {
      return t.priceCents;
    }
  }
  return product.priceCents;
}

export function activeTierIndex(
  product: Product,
  cases: number,
): number | null {
  const tiers = sortedTiers(product);
  if (tiers.length === 0) return null;
  const safe = Math.max(product.moqCases ?? 1, cases);
  for (let i = tiers.length - 1; i >= 0; i--) {
    const t = tiers[i]!;
    const maxOk = t.maxCases == null || safe <= t.maxCases;
    if (safe >= t.minCases && maxOk) {
      return i;
    }
  }
  return null;
}

export function subtotalCentsForCases(product: Product, cases: number): number {
  const unit = pricePerCaseCents(product, cases);
  return unit * Math.max(0, cases);
}
