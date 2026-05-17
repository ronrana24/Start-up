import { JsonLd } from "@presentation/components/seo/json-ld";
import { ProductSeoContent } from "@presentation/components/seo/product-seo-content";
import { ProductDetailScreen } from "@presentation/features/product-detail-screen";
import { getSeoProductById } from "@infrastructure/seo/seo-product-source";
import {
  productSeoDescription,
  productSeoTitle,
} from "@presentation/lib/seo-content";
import { absoluteUrl, assetUrl } from "@presentation/lib/seo-config";
import { categoryPath, productPath } from "@presentation/lib/product-url";
import {
  breadcrumbJsonLd,
  productFaqJsonLd,
  productJsonLd,
} from "@presentation/lib/structured-data";
import type { Metadata } from "next";

type ProductPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getSeoProductById(id);
  if (!product) {
    return {
      title: "Product not found",
      robots: { index: false, follow: false },
    };
  }

  const canonical = productPath(product);
  const description = productSeoDescription(product);
  const title = productSeoTitle(product);
  const images = [product.imageUrl, ...(product.galleryImageUrls ?? [])]
    .filter(Boolean)
    .slice(0, 4)
    .map((url) => ({
      url: assetUrl(url),
      alt: `${product.title} product image`,
    }));

  return {
    title,
    description,
    alternates: { canonical },
    keywords: [
      product.title,
      product.brand ?? "",
      `${product.title} wholesale`,
      `${product.title} bulk`,
      `${product.title} supplier`,
    ].filter(Boolean),
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(canonical),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getSeoProductById(id);
  return (
    <>
      {product ? (
        <>
          <JsonLd data={productJsonLd(product)} />
          <JsonLd data={productFaqJsonLd(product)} />
          <JsonLd
            data={breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Catalog", url: "/catalog" },
              {
                name: product.brand ?? "Products",
                url: product.brand ? categoryPath(product.brand) : "/catalog",
              },
              { name: product.title, url: productPath(product) },
            ])}
          />
        </>
      ) : null}
      <ProductDetailScreen />
      {product ? <ProductSeoContent product={product} /> : null}
    </>
  );
}
