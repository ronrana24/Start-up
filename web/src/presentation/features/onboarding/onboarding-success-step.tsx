import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";
import { OrderSuccessCheckmark } from "@presentation/components/order/order-success-checkmark";

type OnboardingSuccessStepProps = {
  onFinish: () => void;
};

export function OnboardingSuccessStep({ onFinish }: OnboardingSuccessStepProps) {
  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden bg-primary-light/60">
      <div className="flex flex-col items-center rounded-lg bg-card p-8 text-center">
        <OrderSuccessCheckmark className="mx-auto" />
        <h1 className="mt-6 text-2xl font-bold text-heading">You&apos;re all set</h1>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          Your business profile and delivery address are saved. Browse the catalog when you&apos;re
          ready.
        </p>
        <Button type="button" fullWidth className="mt-8" onClick={onFinish}>
          Get started
        </Button>
      </div>
    </Card>
  );
}
