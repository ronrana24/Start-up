import { AuthLoginScreen } from "@presentation/features/auth-login-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Login");

export default function LoginPage() {
  return <AuthLoginScreen />;
}
