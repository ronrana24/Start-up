import { Card } from "@presentation/components/ui/card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Dispense - B2B Disposable Supply Platform",
  description:
    "Learn how Dispense helps restaurants, offices, caterers, retailers, and operations teams procure disposable products and packaging supplies.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-heading">About Us</h1>
      <Card>
        <p className="text-sm text-secondary">
          Dispense is a mobile-friendly storefront focused on a simple catalog
          and checkout experience. This page is a placeholder for your brand
          story, team, and values.
        </p>
      </Card>
    </div>
  );
}
