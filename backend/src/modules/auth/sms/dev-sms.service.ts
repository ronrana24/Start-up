import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';

@Injectable()
export class DevSmsService implements SmsService {
  private readonly logger = new Logger(DevSmsService.name);

  sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(
      `OTP for ${phone}: ${code} (dev stub — configure a real SMS provider in production)`,
    );
    return Promise.resolve();
  }
}
