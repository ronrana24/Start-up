"use client";

import { Card } from "@presentation/components/ui/card";
import { useProductsQuery } from "@presentation/hooks/use-products-query";
import { productPath } from "@presentation/lib/product-url";
import { formatMoney } from "@presentation/lib/format-money";
import Link from "next/link";

type HomeCatalogProps = {
  /** When false, renders only the grid (or loading/error) — for use under a page-level intro. */
  showIntro?: boolean;
};

export function HomeCatalog({ showIntro = true }: HomeCatalogProps) {
  const { data, isPending, isError, refetch } = useProductsQuery();

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={String(i)}
            className="h-48 animate-pulse rounded-xl bg-secondary-bg"
          />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="text-center">
        <p className="text-secondary">Could not load products.</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-primary"
          onClick={() => refetch()}
        >
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {showIntro ? (
        <div>
          <h1 className="text-2xl font-bold text-heading">Shop</h1>
          <p className="text-sm text-secondary">
            Fresh picks for your routine.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.map((product) => (
          <Link key={product.id} href={productPath(product)} className="group">
            <Card className="h-full p-0 overflow-hidden transition-shadow group-hover:shadow-md">
              <div className="aspect-[4/3] bg-primary-light">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-3">
                <h2 className="line-clamp-2 text-sm font-semibold text-heading">
                  {product.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-primary">
                  {formatMoney(product.priceCents, product.currency)}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
