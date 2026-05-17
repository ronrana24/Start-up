import type { Product } from "@domain/product";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function productSlug(product: Pick<Product, "title">): string {
  return slugify(product.title) || "product";
}

export function productPath(product: Pick<Product, "id" | "title">): string {
  return `/products/${encodeURIComponent(product.id)}/${productSlug(product)}`;
}

export function productPathById(id: string, title?: string): string {
  const slug = title ? slugify(title) : "";
  return slug
    ? `/products/${encodeURIComponent(id)}/${slug}`
    : `/products/${encodeURIComponent(id)}`;
}

export function categorySlug(category: string): string {
  return slugify(category) || "disposable-products";
}

export function categoryPath(category: string): string {
  return `/categories/${categorySlug(category)}`;
}

export function citySlug(city: string): string {
  return slugify(city) || "city";
}

export function cityPath(city: string): string {
  return `/locations/${citySlug(city)}`;
}
