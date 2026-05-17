import { listSeoCategories } from "@infrastructure/seo/seo-product-source";
import {
  absoluteUrl,
  SEO_CITIES,
  SEO_STATIC_ROUTES,
} from "@presentation/lib/seo-config";
import { categoryPath, cityPath } from "@presentation/lib/product-url";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const categories = await listSeoCategories();

  return [
    ...SEO_STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(categoryPath(category)),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    })),
    ...SEO_CITIES.map((city) => ({
      url: absoluteUrl(cityPath(city)),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    })),
  ];
}
