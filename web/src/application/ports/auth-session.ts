export type AuthSession = {
  accessToken: string | null;
  userId: string;
  phone: string | null;
  role: "BUYER" | "ADMIN" | "RIDER";
};
