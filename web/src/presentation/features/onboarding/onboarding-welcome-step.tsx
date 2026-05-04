import { Button } from "@presentation/components/ui/button";
import { Card } from "@presentation/components/ui/card";

type OnboardingWelcomeStepProps = {
  onNext: () => void;
};

export function OnboardingWelcomeStep({ onNext }: OnboardingWelcomeStepProps) {
  return (
    <Card className="mx-auto w-full max-w-md overflow-hidden bg-primary-light/60">
      <div className="onboarding-welcome-animate rounded-lg bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Welcome
        </p>
        <h1 className="mt-2 text-2xl font-bold text-heading">
          Let&apos;s set up your wholesale account
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-secondary">
          A few quick details help us verify eligibility and deliver to the right place.
        </p>
        <Button type="button" className="mt-8 w-full" onClick={onNext}>
          Next
        </Button>
      </div>
    </Card>
  );
}
