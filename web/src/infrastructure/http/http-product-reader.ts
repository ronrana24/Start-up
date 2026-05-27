import type { ProductReader } from "@application/ports/product-reader";
import type { BulkTier, Product, ProductId } from "@domain/product";
import { apiJsonAuthorized } from "./http-client";

type ApiEnvelope<T> = { data: T };
type ApiPaginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type ApiBatch = {
  batchId: string;
  batchNumber: number;
  sellingPrice: string | number;
  quantity: number;
  bulkTiers?: Array<{
    minimumQuantity: number;
    pricePerUnit: string | number;
  }>;
  createdAt: string;
};

export type ApiProduct = {
  id: string;
  name: string;
  category: string;
  unit: "PIECE" | "PACK";
  piecesPerPack?: number | null;
  imageUrls?: string[];
  effectivePrice?: string | number;
  pricingSource?: "BATCH" | "SPECIAL";
  specialPricing?: {
    label: string;
    discountType: "PERCENT_OFF" | "AMOUNT_OFF";
    discountValue: string | number;
    originalPrice: string | number;
    effectivePrice: string | number;
  } | null;
  activeSellingPrice?: string | number | null;
  hasMultipleBatches?: boolean;
  totalAvailableQty?: number;
  batches?: ApiBatch[];
  createdAt?: string;
  updatedAt?: string;
};

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function priceToCents(value: string | number | undefined): number {
  return Math.round(Number(value ?? 0) * 100);
}

/**
 * Aggregate the union of every batch's bulk tiers as a default product-level
 * preview. Each batch still owns its own tier list — this is just a convenience
 * for legacy UI that wants a single tier table to display.
 */
function aggregateBulkTiers(product: ApiProduct): BulkTier[] {
  const seen = new Map<number, BulkTier>();
  for (const batch of product.batches ?? []) {
    for (const tier of batch.bulkTiers ?? []) {
      const cents = priceToCents(tier.pricePerUnit);
      const existing = seen.get(tier.minimumQuantity);
      if (!existing || existing.priceCents > cents) {
        seen.set(tier.minimumQuantity, {
          minCases: tier.minimumQuantity,
          maxCases: null,
          priceCents: cents,
          savingsLabel: null,
        });
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.minCases - b.minCases);
}

export function mapApiProduct(product: ApiProduct): Product {
  const activeBatchPriceCents = priceToCents(product.activeSellingPrice ?? 0);
  const effectivePriceCents = product.effectivePrice
    ? priceToCents(product.effectivePrice)
    : activeBatchPriceCents;
  const imageUrls = (product.imageUrls ?? []).filter(Boolean);
  const imageUrl = imageUrls[0] ?? "/placeholder-product.svg";
  const totalAvailableQty = product.totalAvailableQty ?? 0;
  return {
    id: product.id,
    title: product.name,
    description: `${product.name} for wholesale disposable supply orders.`,
    basePriceCents: activeBatchPriceCents || undefined,
    priceCents: effectivePriceCents,
    currency: "INR",
    pricingSource: product.pricingSource ?? "BATCH",
    specialPricing: product.specialPricing
      ? {
          label: product.specialPricing.label,
          discountType: product.specialPricing.discountType,
          discountValue: Number(product.specialPricing.discountValue),
          originalPriceCents: priceToCents(
            product.specialPricing.originalPrice,
          ),
          effectivePriceCents: priceToCents(
            product.specialPricing.effectivePrice,
          ),
        }
      : null,
    imageUrl,
    galleryImageUrls: imageUrls.slice(1),
    brand: product.category,
    sku: product.id.slice(0, 8).toUpperCase(),
    inStock: totalAvailableQty > 0,
    unitLabel: product.unit.toLowerCase(),
    packSizeNote:
      product.unit === "PACK" && product.piecesPerPack
        ? `${product.piecesPerPack} pieces per pack`
        : product.unit === "PACK"
          ? "pack"
          : "piece",
    bulkTiers: aggregateBulkTiers(product),
    moqCases: 1,
    quickCasePresets: [1, 5, 10],
    activeBatchSellingPriceCents:
      product.activeSellingPrice == null
        ? null
        : priceToCents(product.activeSellingPrice),
    hasMultipleBatches: product.hasMultipleBatches ?? false,
    totalAvailableQty,
    batches: (product.batches ?? []).map((batch) => ({
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      sellingPriceCents: priceToCents(batch.sellingPrice),
      remainingQty: batch.quantity,
      bulkTiers: (batch.bulkTiers ?? []).map((tier) => ({
        minCases: tier.minimumQuantity,
        maxCases: null,
        priceCents: priceToCents(tier.pricePerUnit),
        savingsLabel: null,
      })),
    })),
  };
}

export function createHttpProductReader(baseUrl: string): ProductReader {
  return {
    async list(): Promise<Product[]> {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        publicOnly: "true",
      });
      const body = unwrapBody(
        await apiJsonAuthorized<
          ApiPaginated<ApiProduct> | ApiEnvelope<ApiPaginated<ApiProduct>>
        >(baseUrl, `/api/products?${params.toString()}`, { method: "GET" }),
      );
      return body.items.map(mapApiProduct);
    },
    async getById(id: ProductId): Promise<Product | null> {
      try {
        const params = new URLSearchParams({ publicOnly: "true" });
        return mapApiProduct(
          unwrapBody(
            await apiJsonAuthorized<ApiProduct | ApiEnvelope<ApiProduct>>(
              baseUrl,
              `/api/products/${id}?${params.toString()}`,
              { method: "GET" },
            ),
          ),
        );
      } catch {
        return null;
      }
    },
  };
}
