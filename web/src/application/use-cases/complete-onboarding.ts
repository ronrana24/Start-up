import type { AppDependencies } from "@application/app-dependencies";
import type {
  CreateUserAddressInput,
  UpdateUserProfileInput,
} from "@application/ports/user-profile-gateway";

export type CompleteOnboardingInput = {
  accessToken: string | null;
  profile: UpdateUserProfileInput;
  address: CreateUserAddressInput;
};

export async function completeOnboarding(
  deps: AppDependencies,
  input: CompleteOnboardingInput,
): Promise<void> {
  await deps.userProfileGateway.updateProfile(input.accessToken, input.profile);
  await deps.userProfileGateway.createAddress(input.accessToken, {
    ...input.address,
    isDefault: input.address.isDefault ?? true,
  });
  await deps.userProfileGateway.updateProfile(input.accessToken, {
    isOnboardingCompleted: true,
  });
}
