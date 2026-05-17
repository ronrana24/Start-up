import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms and service conditions for using Dispense to purchase disposable products and packaging supplies.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-heading">Terms of Service</h1>
      <p className="mt-4 text-sm text-secondary">
        This is a placeholder page. Replace with your legal terms before
        production.
      </p>
      <p className="mt-8">
        <Link
          href="/login"
          className="text-sm font-semibold text-primary underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
