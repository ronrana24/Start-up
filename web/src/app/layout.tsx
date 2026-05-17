import { AppProviders } from "@presentation/providers/app-providers";
import { JsonLd } from "@presentation/components/seo/json-ld";
import { siteUrl } from "@presentation/lib/seo-config";
import {
  organizationJsonLd,
  websiteJsonLd,
} from "@presentation/lib/structured-data";
import type { Metadata } from "next";
import { Geist_Mono, Rethink_Sans } from "next/font/google";
import "./globals.css";

const rethinkSans = Rethink_Sans({
  variable: "--font-rethink-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Dispense. | Bulk Disposable Products & Packaging Supplies",
    template: "%s | Dispense",
  },
  description: "Wholesale disposable goods delivered with operational clarity.",
  applicationName: "Dispense",
  keywords: [
    "disposable products supplier",
    "bulk packaging supplies",
    "disposable tableware wholesale",
    "restaurant packaging supplier",
    "B2B disposable goods",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Dispense.",
    url: "/",
    title: "Dispense. | Bulk Disposable Products & Packaging Supplies",
    description:
      "Order disposable tableware, packaging, hygiene, and commercial supplies with fast B2B delivery and transparent bulk pricing.",
    images: [{ url: "/dispense-logo.svg", alt: "Dispense." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dispense. | Bulk Disposable Products & Packaging Supplies",
    description:
      "Order disposable tableware, packaging, hygiene, and commercial supplies with fast B2B delivery and transparent bulk pricing.",
    images: ["/dispense-logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${rethinkSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-page font-sans">
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
