import type { Product } from "@domain/product";
import { formatMoney } from "@presentation/lib/format-money";
import { productFaqs, type SeoFaq } from "./seo-content";
import {
  absoluteUrl,
  assetUrl,
  SEO_BRAND,
  SEO_BRAND_NAME,
  SEO_COUNTRY,
  SEO_DEFAULT_CITY,
  siteUrl,
} from "./seo-config";
import { categoryPath, productPath } from "./product-url";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_BRAND,
    url: siteUrl(),
    logo: absoluteUrl("/dispense-logo.svg"),
    brand: {
      "@type": "Brand",
      name: SEO_BRAND_NAME,
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: SEO_COUNTRY,
        availableLanguage: ["en", "hi"],
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_BRAND,
    url: siteUrl(),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/catalog")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function localBusinessJsonLd(city = SEO_DEFAULT_CITY) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl()}#local-business-${city.toLowerCase()}`,
    name: SEO_BRAND,
    url: siteUrl(),
    image: absoluteUrl("/dispense-logo.svg"),
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      addressCountry: SEO_COUNTRY,
    },
    areaServed: city,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function faqJsonLd(faqs: SeoFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function productJsonLd(product: Product, city = SEO_DEFAULT_CITY) {
  const images = [product.imageUrl, ...(product.galleryImageUrls ?? [])]
    .filter(Boolean)
    .map(assetUrl);
  const availability =
    product.inStock === false
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(productPath(product))}#product`,
    name: product.title,
    description: product.description,
    sku: product.sku ?? product.id,
    brand: {
      "@type": "Brand",
      name: product.brand ?? SEO_BRAND_NAME,
    },
    category: product.brand,
    image: images,
    aggregateRating:
      product.rating && product.reviewCount
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(productPath(product)),
      priceCurrency: product.currency,
      price: (product.priceCents / 100).toFixed(2),
      priceValidUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString()
        .slice(0, 10),
      availability,
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: SEO_BRAND,
      },
      areaServed: city,
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: SEO_COUNTRY,
          addressRegion: city,
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 2,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 3,
            unitCode: "DAY",
          },
        },
      },
    },
    additionalProperty: [
      product.packSizeNote
        ? {
            "@type": "PropertyValue",
            name: "Pack size",
            value: product.packSizeNote,
          }
        : null,
      ...(product.logistics ?? []).map((item) => ({
        "@type": "PropertyValue",
        name: item.label,
        value: item.value,
      })),
    ].filter(Boolean),
  };
}

export function productFaqJsonLd(product: Product) {
  return faqJsonLd(productFaqs(product));
}

export function itemListJsonLd(products: Product[], name: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url: absoluteUrl(url),
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(productPath(product)),
      name: product.title,
      image: assetUrl(product.imageUrl),
    })),
  };
}

export function categoryCollectionJsonLd(
  category: string,
  products: Product[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category} wholesale products`,
    url: absoluteUrl(categoryPath(category)),
    mainEntity: itemListJsonLd(
      products,
      `${category} products`,
      categoryPath(category),
    ),
  };
}

export function priceLabel(product: Product): string {
  return formatMoney(product.priceCents, product.currency);
}
