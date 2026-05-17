import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy information for buyers, admins, and users of the Dispense ecommerce and delivery platform.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-heading">Privacy Policy</h1>
      <p className="mt-4 text-sm text-secondary">
        This is a placeholder page. Replace with your privacy policy before
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
