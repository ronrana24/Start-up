import { UserRole } from "@/presentation/features/admin/admin-api";

export type AuthSession = {
  accessToken: string | null;
  userId: string;
  phone: string | null;
  roles: UserRole[];
  isOnboardingCompleted: boolean;
};
