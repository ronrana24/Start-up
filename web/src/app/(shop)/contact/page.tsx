import { Card } from "@presentation/components/ui/card";
import { JsonLd } from "@presentation/components/seo/json-ld";
import { localBusinessJsonLd } from "@presentation/lib/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Dispense - Wholesale Disposable Product Support",
  description:
    "Contact Dispense for disposable product supply, packaging procurement, bulk order support, partnerships, and B2B delivery help.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-4">
      <JsonLd data={localBusinessJsonLd()} />
      <h1 className="text-2xl font-bold text-heading">Contact Us</h1>
      <Card>
        <p className="text-sm text-secondary">
          Reach out for support, partnerships, or general questions. Replace
          this text with your contact details, hours, and support channels.
        </p>
      </Card>
    </div>
  );
}
