import type { AuthSession } from "@application/ports/auth-session";

export type GoogleLoginResult =
  | { kind: "authenticated"; session: AuthSession }
  | {
      kind: "needs_phone";
      registrationToken: string;
      profile: { email: string; name?: string; picture?: string };
    };

export interface AuthGateway {
  loginWithGoogle(idToken: string): Promise<GoogleLoginResult>;
  googleSendOtp(registrationToken: string, phone: string): Promise<void>;
  googleComplete(
    registrationToken: string,
    phone: string,
    code: string,
  ): Promise<AuthSession>;
  logout(): Promise<void>;
}
