export const SMS_SERVICE = Symbol('SMS_SERVICE');

/** OTP delivery; bind `SMS_SERVICE` to `SmsRouterService` for dev vs prod routing via `otp.devMode`. */
export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}
