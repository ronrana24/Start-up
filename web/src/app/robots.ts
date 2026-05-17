import {
  absoluteUrl,
  SEO_STATIC_ROUTES,
  siteUrl,
} from "@presentation/lib/seo-config";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: SEO_STATIC_ROUTES.map((route) => route.path),
        disallow: [
          "/admin/",
          "/account",
          "/cart",
          "/checkout",
          "/login",
          "/onboarding",
          "/orders/",
          "/*?*sort=",
          "/*?*filter=",
          "/*?*page=",
          "/*?*q=",
        ],
      },
    ],
    sitemap: [
      absoluteUrl("/sitemap.xml"),
      absoluteUrl("/product-sitemap.xml"),
      absoluteUrl("/category-sitemap.xml"),
      absoluteUrl("/image-sitemap.xml"),
    ],
    host: siteUrl(),
  };
}
