import { AdminShell } from "@presentation/features/admin/admin-shell";
import { privateMetadata } from "@presentation/lib/private-metadata";

export const metadata = privateMetadata("Admin");

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
