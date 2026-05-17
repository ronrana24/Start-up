import { JsonLd } from "@presentation/components/seo/json-ld";
import {
  listSeoCategories,
  listSeoProducts,
} from "@infrastructure/seo/seo-product-source";
import {
  categoryFaqs,
  categorySeoDescription,
  categorySeoTitle,
} from "@presentation/lib/seo-content";
import {
  absoluteUrl,
  assetUrl,
  SEO_DEFAULT_CITY,
} from "@presentation/lib/seo-config";
import {
  categoryPath,
  categorySlug,
  productPath,
} from "@presentation/lib/product-url";
import {
  breadcrumbJsonLd,
  categoryCollectionJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from "@presentation/lib/structured-data";
import { formatMoney } from "@presentation/lib/format-money";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

async function resolveCategory(slug: string): Promise<string | null> {
  const categories = await listSeoCategories();
  return categories.find((category) => categorySlug(category) === slug) ?? null;
}

export async function generateStaticParams() {
  const categories = await listSeoCategories();
  return categories.map((category) => ({ category: categorySlug(category) }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await resolveCategory(slug);
  if (!category) {
    return { title: "Category not found", robots: { index: false } };
  }
  const title = categorySeoTitle(category);
  const description = categorySeoDescription(category);
  const canonical = categoryPath(category);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: absoluteUrl(canonical),
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await resolveCategory(slug);
  if (!category) notFound();

  const products = (await listSeoProducts()).filter(
    (product) => product.category === category,
  );
  const faqs = categoryFaqs(category);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-28 pt-2 text-heading lg:pb-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Catalog", url: "/catalog" },
          { name: category, url: categoryPath(category) },
        ])}
      />
      <JsonLd data={categoryCollectionJsonLd(category, products)} />
      <JsonLd
        data={itemListJsonLd(
          products,
          `${category} wholesale products`,
          categoryPath(category),
        )}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <header className="rounded-3xl border border-default bg-card p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Wholesale category
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {category} supplier in {SEO_DEFAULT_CITY}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
          Compare {category.toLowerCase()} for restaurants, cafes, hotels,
          offices, event teams, and retail operators. This category page is
          generated from live catalog data so search engines can discover new
          products, pack details, images, and bulk buying paths quickly.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-default bg-card p-5">
          <h2 className="text-sm font-bold">Buyer intent</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Built for teams searching for bulk {category.toLowerCase()},
            commercial pack sizes, supplier reliability, and fast delivery.
          </p>
        </div>
        <div className="rounded-2xl border border-default bg-card p-5">
          <h2 className="text-sm font-bold">Operational fit</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Useful for repeat procurement, storeroom replenishment, and
            packaging workflows where specifications must stay consistent.
          </p>
        </div>
        <div className="rounded-2xl border border-default bg-card p-5">
          <h2 className="text-sm font-bold">SEO freshness</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Product links and sitemap entries update from the public catalog,
            keeping the category crawlable as inventory expands.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Products in {category}</h2>
            <p className="text-sm text-secondary">
              {products.length} live catalog item
              {products.length === 1 ? "" : "s"} available for discovery.
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-primary hover:underline"
          >
            Browse full catalog
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={productPath(product)}
              className="group overflow-hidden rounded-2xl border border-default bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-44 items-center justify-center bg-input-bg p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl(product.imageUrl)}
                  alt={`${product.title} product image`}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  {product.sku ?? product.id}
                </p>
                <h3 className="mt-1 line-clamp-2 text-base font-bold leading-tight">
                  {product.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">
                  {product.description}
                </p>
                <p className="mt-3 text-lg font-black">
                  {formatMoney(product.priceCents, product.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-default bg-card p-5">
        <h2 className="text-xl font-bold">Category FAQs</h2>
        <div className="mt-3 divide-y divide-default">
          {faqs.map((faq) => (
            <details key={faq.question} className="py-3">
              <summary className="cursor-pointer list-none text-sm font-bold">
                {faq.question}
              </summary>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
