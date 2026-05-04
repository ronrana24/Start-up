export type ProductId = string;

export type ProductBadgeTone = "primary" | "accent";

export type ProductBadge = {
  label: string;
  tone?: ProductBadgeTone;
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
  priceCents: number;
  currency: "USD";
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
