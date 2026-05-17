import { AccountScreen } from "@presentation/features/account-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Account");

export default function AccountPage() {
  return <AccountScreen />;
}
