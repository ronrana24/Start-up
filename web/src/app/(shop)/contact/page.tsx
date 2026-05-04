import { Card } from "@presentation/components/ui/card";

export default function ContactPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-heading">Contact Us</h1>
      <Card>
        <p className="text-sm text-secondary">
          Reach out for support, partnerships, or general questions. Replace this text with your
          contact details, hours, and support channels.
        </p>
      </Card>
    </div>
  );
}
