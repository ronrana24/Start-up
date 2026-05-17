import { listSeoCategories } from "@infrastructure/seo/seo-product-source";
import { absoluteUrl, SEO_CITIES } from "@presentation/lib/seo-config";
import { categoryPath, cityPath } from "@presentation/lib/product-url";

export async function GET() {
  const categories = await listSeoCategories();
  const now = new Date().toISOString();
  const urls = [
    ...categories.map((category) => absoluteUrl(categoryPath(category))),
    ...SEO_CITIES.map((city) => absoluteUrl(cityPath(city))),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
