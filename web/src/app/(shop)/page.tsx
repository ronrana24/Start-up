import { HomeLanding } from "@presentation/features/home-landing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk Disposable Products Supplier for Businesses",
  description:
    "Buy disposable tableware, packaging supplies, hygiene products, cleaning essentials, and carry bags with fast B2B delivery from Dispense.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Bulk Disposable Products Supplier for Businesses | Dispense",
    description:
      "Buy disposable tableware, packaging supplies, hygiene products, cleaning essentials, and carry bags with fast B2B delivery from Dispense.",
    url: "/",
  },
};

export default function HomePage() {
  return (
    <>
      <HomeLanding />
    </>
  );
}
