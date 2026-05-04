import type { Product } from "@domain/product";

const ph = "/placeholder-product.svg";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    brand: "ToughPlate",
    sku: "TP-10HD-500",
    title: '10" Heavy Duty Compostable Paper Plates',
    description:
      "Commercial-grade molded fiber plates for catering and retail. Certified compostable where facilities exist.",
    priceCents: 3200,
    currency: "USD",
    imageUrl: ph,
    galleryImageUrls: [ph, ph, ph, ph],
    badges: [
      { label: "Best value", tone: "primary" },
      { label: "Eco", tone: "accent" },
    ],
    rating: 4.8,
    reviewCount: 124,
    inStock: true,
    unitLabel: "case",
    packSizeNote: "Pack size: 500ct (10 sleeves of 50)",
    moqCases: 1,
    quickCasePresets: [1, 5, 10],
    bulkTiers: [
      {
        minCases: 1,
        maxCases: 4,
        priceCents: 3200,
        savingsLabel: null,
      },
      {
        minCases: 5,
        maxCases: 9,
        priceCents: 2950,
        savingsLabel: "8% off",
      },
      {
        minCases: 10,
        maxCases: null,
        priceCents: 2700,
        savingsLabel: "15% off",
      },
    ],
    logistics: [
      { label: "Lead time", value: "1–2 business days" },
      { label: "Material", value: "Molded fiber" },
      { label: "Dimensions", value: '10" diameter' },
      { label: "Case weight", value: "24.5 lbs" },
    ],
    substitutionNote:
      "If this exact item is unavailable, we may substitute an equivalent 10\" compostable plate of equal or greater value so your operations stay on schedule.",
    relatedProductIds: ["p2", "p4"],
  },
  {
    id: "p2",
    title: "Cold brew concentrate",
    description: "Smooth, low-acid concentrate. Makes 12 servings.",
    priceCents: 1299,
    currency: "USD",
    imageUrl: ph,
    brand: "NatureDine",
  },
  {
    id: "p3",
    title: "Stainless bottle 750ml",
    description: "Double-wall vacuum insulated. Keeps drinks cold 24h.",
    priceCents: 3499,
    currency: "USD",
    imageUrl: ph,
  },
  {
    id: "p4",
    title: "Daily greens powder",
    description: "Spinach, kale, spirulina. 30 servings.",
    priceCents: 2499,
    currency: "USD",
    imageUrl: ph,
    brand: "EcoWare",
  },
  {
    id: "p5",
    title: "Ceramic pour-over dripper",
    description: "Fits standard #2 filters. Matte glaze.",
    priceCents: 2899,
    currency: "USD",
    imageUrl: ph,
  },
  {
    id: "p6",
    title: "Linen tote",
    description: "Reinforced straps, interior pocket.",
    priceCents: 4299,
    currency: "USD",
    imageUrl: ph,
  },
];
