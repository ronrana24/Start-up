import type { Product } from "@domain/product";
import {
  type ApiProduct,
  mapApiProduct,
} from "@infrastructure/http/http-product-reader";

type ApiEnvelope<T> = { data: T };
type ApiPaginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type SeoProductRecord = Product & {
  category: string;
  createdAt?: string;
  updatedAt?: string;
};

function unwrapBody<T>(body: T | ApiEnvelope<T>): T {
  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data;
  }
  return body as T;
}

function apiBaseUrl(): string {
  return (
    process.env.SEO_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.API_PROXY_TARGET ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

function mapSeoProduct(product: ApiProduct): SeoProductRecord {
  return {
    ...mapApiProduct(product),
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function listSeoProducts(): Promise<SeoProductRecord[]> {
  const baseUrl = apiBaseUrl();

  try {
    const params = new URLSearchParams({
      page: "1",
      pageSize: "500",
      publicOnly: "true",
    });
    const res = await fetch(`${baseUrl}/api/products?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const body = unwrapBody<ApiPaginated<ApiProduct>>(await res.json());
    return body.items.map(mapSeoProduct);
  } catch {
    return [];
  }
}

export async function getSeoProductById(
  id: string,
): Promise<SeoProductRecord | null> {
  const baseUrl = apiBaseUrl();

  try {
    const params = new URLSearchParams({ publicOnly: "true" });
    const res = await fetch(
      `${baseUrl}/api/products/${encodeURIComponent(id)}?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return null;
    return mapSeoProduct(unwrapBody<ApiProduct>(await res.json()));
  } catch {
    return null;
  }
}

export async function listSeoCategories(): Promise<string[]> {
  const products = await listSeoProducts();
  return Array.from(
    new Set(products.map((product) => product.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
}
