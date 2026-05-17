import { OnboardingScreen } from "@presentation/features/onboarding/onboarding-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Onboarding");

export default function OnboardingPage() {
  return <OnboardingScreen />;
}
