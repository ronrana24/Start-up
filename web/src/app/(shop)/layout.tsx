import { ShopChrome } from "@presentation/features/shop-chrome";
import { ShopOnboardingGate } from "@presentation/features/shop-onboarding-gate";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShopOnboardingGate>
      <ShopChrome>{children}</ShopChrome>
    </ShopOnboardingGate>
  );
}
