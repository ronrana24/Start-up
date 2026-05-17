import { JsonLd } from "@presentation/components/seo/json-ld";
import {
  listSeoCategories,
  listSeoProducts,
} from "@infrastructure/seo/seo-product-source";
import {
  categorySeoDescription,
  citySeoDescription,
  citySeoTitle,
} from "@presentation/lib/seo-content";
import {
  absoluteUrl,
  SEO_BRAND,
  SEO_CITIES,
} from "@presentation/lib/seo-config";
import {
  categoryPath,
  cityPath,
  citySlug,
  productPath,
} from "@presentation/lib/product-url";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  localBusinessJsonLd,
} from "@presentation/lib/structured-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type CityPageProps = {
  params: Promise<{ city: string }>;
};

function resolveCity(slug: string): string | null {
  return SEO_CITIES.find((city) => citySlug(city) === slug) ?? null;
}

export function generateStaticParams() {
  return SEO_CITIES.map((city) => ({ city: citySlug(city) }));
}

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = resolveCity(slug);
  if (!city) {
    return { title: "Location not found", robots: { index: false } };
  }
  const title = citySeoTitle(city);
  const description = citySeoDescription(city);
  return {
    title,
    description,
    alternates: { canonical: cityPath(city) },
    openGraph: {
      title,
      description,
      url: absoluteUrl(cityPath(city)),
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { city: slug } = await params;
  const city = resolveCity(slug);
  if (!city) notFound();

  const [categories, products] = await Promise.all([
    listSeoCategories(),
    listSeoProducts(),
  ]);
  const featured = products.slice(0, 6);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-28 pt-2 text-heading lg:pb-10">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: `Disposable supplier in ${city}`, url: cityPath(city) },
        ])}
      />
      <JsonLd data={localBusinessJsonLd(city)} />
      <JsonLd
        data={itemListJsonLd(
          featured,
          `Disposable products available in ${city}`,
          cityPath(city),
        )}
      />

      <header className="rounded-3xl border border-default bg-card p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Local B2B supply
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Disposable products supplier in {city}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
          {SEO_BRAND} helps businesses in {city} source disposable tableware,
          packaging and carry bags, tissue and hygiene products, cleaning
          supplies, and commercial replenishment essentials through a fast,
          searchable catalog.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {categories.slice(0, 6).map((category) => (
          <Link
            key={category}
            href={categoryPath(category)}
            className="rounded-2xl border border-default bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <h2 className="text-base font-bold">{category}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-secondary">
              {categorySeoDescription(category, city)}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-default bg-card p-5 shadow-sm">
        <h2 className="text-xl font-bold">
          Fast procurement paths for {city} teams
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <p className="text-sm leading-7 text-secondary">
            Local SEO pages like this are generated from structured category and
            catalog data, giving Google clearer entity relationships between
            location, product category, buyer intent, and B2B delivery.
          </p>
          <ul className="space-y-2 text-sm leading-6 text-secondary">
            <li>Restaurant and cloud kitchen disposable supply.</li>
            <li>Retail, office, and hospitality packaging replenishment.</li>
            <li>Event, catering, and banquet disposable tableware.</li>
            <li>Transparent product discovery with product-level URLs.</li>
          </ul>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Featured products</h2>
            <p className="text-sm text-secondary">
              Crawlable links into product pages for local buying journeys.
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-sm font-bold text-primary hover:underline"
          >
            View catalog
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <Link
              key={product.id}
              href={productPath(product)}
              className="rounded-2xl border border-default bg-card p-4 shadow-sm transition hover:border-primary/40"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {product.brand ?? "Disposable Products"}
              </p>
              <h3 className="mt-1 line-clamp-2 text-base font-bold">
                {product.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">
                {product.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
