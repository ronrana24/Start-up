import type { AuthGateway } from "@application/ports/auth-gateway";
import { DomainError } from "@domain/errors";

export function createUnavailableAuthGateway(): AuthGateway {
  const msg =
    "Google sign-in requires NEXT_PUBLIC_API_BASE_URL pointing at your API.";
  return {
    async loginWithGoogle() {
      throw new DomainError("INVALID_INPUT", msg);
    },
    async googleSendOtp() {
      throw new DomainError("INVALID_INPUT", msg);
    },
    async googleComplete() {
      throw new DomainError("INVALID_INPUT", msg);
    },
    async logout() {
      /* No remote cookie exists. */
    },
  };
}
