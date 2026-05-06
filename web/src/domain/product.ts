export type ProductId = string;

export type ProductBadgeTone = "primary" | "accent";

export type ProductBadge = {
  label: string;
  tone?: ProductBadgeTone;
};

export type PricingSource = "BASE" | "BULK" | "SPECIAL";

export type ProductSpecialPricing = {
  label: string;
  discountType: "PERCENT_OFF" | "AMOUNT_OFF";
  discountValue: number;
  originalPriceCents: number;
  effectivePriceCents: number;
};

export type BulkTier = {
  minCases: number;
  maxCases: number | null;
  priceCents: number;
  savingsLabel?: string | null;
};

export type LogisticsSpec = {
  label: string;
  value: string;
};

export type Product = {
  id: ProductId;
  title: string;
  description: string;
  basePriceCents?: number;
  priceCents: number;
  currency: "USD" | "INR";
  pricingSource?: PricingSource;
  specialPricing?: ProductSpecialPricing | null;
  imageUrl: string;
  /** Extra gallery images; first hero can match imageUrl */
  galleryImageUrls?: string[];
  badges?: ProductBadge[];
  brand?: string;
  sku?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  /** e.g. "case" */
  unitLabel?: string;
  packSizeNote?: string;
  bulkTiers?: BulkTier[];
  logistics?: LogisticsSpec[];
  substitutionNote?: string;
  moqCases?: number;
  quickCasePresets?: number[];
  relatedProductIds?: ProductId[];
};
