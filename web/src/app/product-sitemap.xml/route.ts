import { listSeoProducts } from "@infrastructure/seo/seo-product-source";
import { absoluteUrl } from "@presentation/lib/seo-config";
import { productPath } from "@presentation/lib/product-url";
import type { MetadataRoute } from "next";

export async function GET() {
  const products = await listSeoProducts();
  const sitemap: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(productPath(product)),
    lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${new Date(entry.lastModified ?? Date.now()).toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
