import { AdminShell } from "@presentation/features/admin/admin-shell";

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
