import type { AuthSession } from "@application/ports/auth-session";
import { DEMO_USER_ID } from "@domain/demo-user";
import type { OtpGateway } from "@application/ports/otp-gateway";
import { delay } from "@infrastructure/mock/delay";

export function createMockOtpGateway(): OtpGateway {
  return {
    async requestOtp(phone: string): Promise<void> {
      void phone;
      await delay(350);
    },
    async verifyOtp(phone: string, code: string): Promise<AuthSession | null> {
      await delay(300);
      if (!/^\d{6}$/.test(code)) {
        return null;
      }
      return {
        accessToken: "",
        userId: DEMO_USER_ID,
        phone: phone.trim() || null,
        role: "BUYER",
      };
    },
  };
}
