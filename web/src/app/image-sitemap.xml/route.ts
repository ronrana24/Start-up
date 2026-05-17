import { listSeoProducts } from "@infrastructure/seo/seo-product-source";
import { absoluteUrl, assetUrl } from "@presentation/lib/seo-config";
import { productPath } from "@presentation/lib/product-url";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const products = await listSeoProducts();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${products
  .map((product) => {
    const images = [product.imageUrl, ...(product.galleryImageUrls ?? [])]
      .filter(Boolean)
      .slice(0, 10);
    return `  <url>
    <loc>${xmlEscape(absoluteUrl(productPath(product)))}</loc>
${images
  .map(
    (image) => `    <image:image>
      <image:loc>${xmlEscape(assetUrl(image))}</image:loc>
      <image:title>${xmlEscape(product.title)}</image:title>
      <image:caption>${xmlEscape(`${product.title} from Dispense.`)}</image:caption>
    </image:image>`,
  )
  .join("\n")}
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
