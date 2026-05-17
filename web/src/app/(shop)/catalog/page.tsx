import { CatalogScreen } from "@presentation/features/catalog-screen";
import { JsonLd } from "@presentation/components/seo/json-ld";
import { listSeoProducts } from "@infrastructure/seo/seo-product-source";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
} from "@presentation/lib/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Catalog - Wholesale Disposable Products",
  description:
    "Browse disposable tableware, packaging, carry bags, tissue, hygiene, cleaning, and fragrance products with B2B bulk pricing.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Wholesale Disposable Products Catalog | Dispense",
    description:
      "Browse disposable tableware, packaging, carry bags, tissue, hygiene, cleaning, and fragrance products with B2B bulk pricing.",
    url: "/catalog",
  },
};

type CatalogPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { q } = await searchParams;
  const products = await listSeoProducts();
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Catalog", url: "/catalog" },
        ])}
      />
      <JsonLd
        data={itemListJsonLd(
          products,
          "Wholesale disposable products catalog",
          "/catalog",
        )}
      />
      <CatalogScreen initialSearch={q ?? ""} />
    </>
  );
}
