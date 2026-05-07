import type { ProductReader } from "@application/ports/product-reader";
import type { BulkTier, Product, ProductId } from "@domain/product";
import { apiJsonAuthorized } from "./http-client";

type ApiEnvelope<T> = { data: T };
type ApiPaginated<T> = { items: T[]; total: number; page: number; pageSize: number };

type ApiProduct = {
  id: string;
  name: string;
  category: string;
  unit: "PIECE" | "PACK";
  piecesPerPack?: number | null;
  basePrice: string | number;
  imageUrls?: string[];
  effectivePrice?: string | number;
  pricingSource?: "BASE" | "BULK" | "SPECIAL";
  specialPricing?: {
    label: string;
    discountType: "PERCENT_OFF" | "AMOUNT_OFF";
    discountValue: string | number;
    originalPrice: string | number;
    effectivePrice: string | number;
  } | null;
  bulkPricingTiers: Array<{ minQty: number; price: string | number }>;
  inventory?: { availableQty: number } | null;
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

function mapBulkTiers(product: ApiProduct): BulkTier[] {
  return (product.bulkPricingTiers ?? []).map((tier) => ({
    minCases: tier.minQty,
    maxCases: null,
    priceCents: priceToCents(tier.price),
    savingsLabel: null,
  }));
}

function mapProduct(product: ApiProduct): Product {
  const basePriceCents = priceToCents(product.basePrice);
  const effectivePriceCents = priceToCents(
    product.effectivePrice ?? product.basePrice,
  );
  const imageUrls = (product.imageUrls ?? []).filter(Boolean);
  const imageUrl = imageUrls[0] ?? "/placeholder-product.svg";
  return {
    id: product.id,
    title: product.name,
    description: `${product.name} for wholesale disposable supply orders.`,
    basePriceCents,
    priceCents: effectivePriceCents,
    currency: "INR",
    pricingSource: product.pricingSource ?? "BASE",
    specialPricing: product.specialPricing
      ? {
          label: product.specialPricing.label,
          discountType: product.specialPricing.discountType,
          discountValue: Number(product.specialPricing.discountValue),
          originalPriceCents: priceToCents(product.specialPricing.originalPrice),
          effectivePriceCents: priceToCents(product.specialPricing.effectivePrice),
        }
      : null,
    imageUrl,
    galleryImageUrls: imageUrls.slice(1),
    brand: product.category,
    sku: product.id.slice(0, 8).toUpperCase(),
    inStock: (product.inventory?.availableQty ?? 0) > 0,
    unitLabel: product.unit.toLowerCase(),
    packSizeNote:
      product.unit === "PACK" && product.piecesPerPack
        ? `${product.piecesPerPack} pieces per pack`
        : product.unit === "PACK"
          ? "pack"
          : "piece",
    bulkTiers: mapBulkTiers(product),
    moqCases: 1,
    quickCasePresets: [1, 5, 10],
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
      return body.items.map(mapProduct);
    },
    async getById(id: ProductId): Promise<Product | null> {
      try {
        const params = new URLSearchParams({ publicOnly: "true" });
        return mapProduct(
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
