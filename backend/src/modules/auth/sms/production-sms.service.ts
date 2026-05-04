import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SmsService } from './sms.service';

/** Placeholder until a real SMS provider is wired; used when `otp.devMode` is false. */
@Injectable()
export class ProductionSmsService implements SmsService {
  sendOtp(phone: string, code: string): Promise<void> {
    void phone;
    void code;
    return Promise.reject(
      new ServiceUnavailableException(
        'SMS provider is not configured. Set OTP_DEV_MODE=true for local development or integrate an SMS gateway.',
      ),
    );
  }
}
