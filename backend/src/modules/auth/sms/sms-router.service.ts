import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevSmsService } from './dev-sms.service';
import { ProductionSmsService } from './production-sms.service';
import type { SmsService } from './sms.service';

/**
 * Bound to {@link SMS_SERVICE}; picks {@link DevSmsService} vs {@link ProductionSmsService}
 * from `otp.devMode` so callers only depend on `SmsService`.
 */
@Injectable()
export class SmsRouterService implements SmsService {
  constructor(
    private readonly config: ConfigService,
    private readonly devSms: DevSmsService,
    private readonly productionSms: ProductionSmsService,
  ) {}

  sendOtp(phone: string, code: string): Promise<void> {
    if (this.config.get<boolean>('otp.devMode') === true) {
      return this.devSms.sendOtp(phone, code);
    }
    return this.productionSms.sendOtp(phone, code);
  }
}
