export const SEO_BRAND_NAME = "Dispense";
export const SEO_BRAND = "Dispense.";
export const SEO_PRIMARY_COLOR = "#1F7A63";
export const SEO_DEFAULT_CITY = "Chandigarh";
export const SEO_COUNTRY = "IN";
export const SEO_LOCALE = "en_IN";

export const SEO_CITIES = [
  "Chandigarh",
  "Mohali",
  "Panchkula",
  "Zirakpur",
  "Delhi",
  "Gurugram",
] as const;

export const SEO_STATIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "daily" as const },
  { path: "/catalog", priority: 0.95, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
] as const;

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ??
    "https://www.dispense.in"
  );
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;
  return `${siteUrl()}${normalizedPath}`;
}

export function assetUrl(pathOrUrl: string): string {
  return absoluteUrl(pathOrUrl || "/placeholder-product.svg");
}
