import { AdminLoginScreen } from "@presentation/features/admin/admin-login-screen";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Admin Login");

export default function AdminLoginPage() {
  return <AdminLoginScreen />;
}
