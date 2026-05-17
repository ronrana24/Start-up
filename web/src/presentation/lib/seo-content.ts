import type { Product } from "@domain/product";
import { SEO_BRAND, SEO_DEFAULT_CITY } from "./seo-config";

export type SeoFaq = {
  question: string;
  answer: string;
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function productPrimaryKeyword(product: Product): string {
  return compact(`${product.title} wholesale`);
}

export function productSecondaryKeywords(product: Product): string[] {
  const category = product.brand ?? "disposable products";
  return [
    `bulk ${product.title}`,
    `${product.title} supplier`,
    `${category} wholesale`,
    `commercial ${category}`,
    `${product.title} for restaurants`,
    `${product.title} for catering`,
  ].map(compact);
}

export function productLongTailKeywords(
  product: Product,
  city = SEO_DEFAULT_CITY,
): string[] {
  const category = product.brand ?? "packaging supplies";
  return [
    `buy ${product.title} online in ${city}`,
    `${category} distributor near me`,
    `bulk ${product.title} with fast delivery`,
    `disposable ${category} for hotels and restaurants`,
    `B2B ${product.title} supplier in ${city}`,
  ].map(compact);
}

export function productSeoTitle(
  product: Product,
  city = SEO_DEFAULT_CITY,
): string {
  return compact(`Buy ${product.title} Online in ${city} | ${SEO_BRAND}`);
}

export function productSeoDescription(
  product: Product,
  city = SEO_DEFAULT_CITY,
): string {
  return compact(
    `Order premium ${product.title} in ${city} with bulk pricing, reliable stock, and fast delivery from ${SEO_BRAND} for restaurants, caterers, offices, and retail teams.`,
  ).slice(0, 158);
}

export function categorySeoTitle(
  category: string,
  city = SEO_DEFAULT_CITY,
): string {
  return compact(`Bulk ${category} Supplier in ${city} | ${SEO_BRAND}`);
}

export function categorySeoDescription(
  category: string,
  city = SEO_DEFAULT_CITY,
): string {
  return compact(
    `Shop ${category.toLowerCase()} for restaurants, offices, events, and commercial buyers in ${city}. Compare bulk pricing, pack sizes, and fast delivery options from ${SEO_BRAND}.`,
  ).slice(0, 158);
}

export function citySeoTitle(city: string): string {
  return compact(`Disposable Products Supplier in ${city} | ${SEO_BRAND}`);
}

export function citySeoDescription(city: string): string {
  return compact(
    `${SEO_BRAND} supplies disposable tableware, hygiene products, cleaning supplies, packaging, and carry bags to businesses across ${city} with fast B2B delivery.`,
  ).slice(0, 158);
}

export function productSeoIntro(product: Product): string {
  const category = product.brand ?? "disposable supplies";
  return compact(
    `${product.title} is built for commercial teams that need dependable ${category.toLowerCase()} without slow procurement cycles. ${SEO_BRAND} helps buyers compare pack details, unlock bulk pricing, and reorder essentials with operational clarity.`,
  );
}

export function productUseCases(product: Product): string[] {
  const category = product.brand ?? "disposable supplies";
  return [
    `Restaurant, cafe, and cloud kitchen replenishment for ${category.toLowerCase()}.`,
    "Catering, events, and banquet operations that need predictable case quantities.",
    "Retail, office, hospitality, and institutional procurement where stockouts create service delays.",
    "Bulk purchasing workflows that require transparent pricing and repeatable specifications.",
  ];
}

export function productFeatureBullets(product: Product): string[] {
  const material = product.logistics?.find((item) =>
    /material/i.test(item.label),
  )?.value;
  return [
    product.packSizeNote
      ? `Commercial pack detail: ${product.packSizeNote}.`
      : "Commercial pack information is visible before ordering.",
    material
      ? `Material detail: ${material}.`
      : "Suitable for high-volume disposable product operations.",
    product.inStock === false
      ? "Currently marked out of stock so teams can avoid failed procurement."
      : "Available for ordering with fast replenishment workflows.",
    "Supports bulk ordering, repeat purchasing, and delivery tracking inside one B2B storefront.",
  ];
}

export function productFaqs(product: Product): SeoFaq[] {
  const category = product.brand ?? "disposable products";
  return [
    {
      question: `Can I order ${product.title} in bulk?`,
      answer: `Yes. ${SEO_BRAND} is designed for bulk B2B orders, and eligible products show tiered pricing or pack details directly on the product page.`,
    },
    {
      question: `Who typically buys ${product.title}?`,
      answer: `${product.title} is commonly used by restaurants, caterers, hotels, offices, retailers, and teams that regularly replenish ${category.toLowerCase()}.`,
    },
    {
      question: `Is ${product.title} available for fast delivery?`,
      answer:
        product.inStock === false
          ? "This item is currently out of stock. You can still review the details and choose an alternative product from the catalog."
          : `Yes. ${SEO_BRAND} prioritizes reliable delivery workflows for commercial buyers and operational teams.`,
    },
    {
      question: `How do I compare ${product.title} with similar products?`,
      answer:
        "Use the catalog filters, category pages, product images, pack details, and related products to compare alternatives before placing an order.",
    },
  ];
}

export function categoryFaqs(category: string): SeoFaq[] {
  return [
    {
      question: `Can businesses order ${category} in bulk?`,
      answer: `Yes. ${SEO_BRAND} supports B2B bulk ordering, repeat purchasing, and pack-level comparison for ${category.toLowerCase()}.`,
    },
    {
      question: `Which industries use ${category}?`,
      answer:
        "Restaurants, cafes, caterers, hotels, retailers, offices, and event operators commonly purchase these supplies for daily operations.",
    },
    {
      question: "How quickly can orders be delivered?",
      answer:
        "Delivery speed depends on inventory, address, and order workflow, but the platform is structured for fast replenishment and clear order tracking.",
    },
  ];
}
