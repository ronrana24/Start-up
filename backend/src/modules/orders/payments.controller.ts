import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RazorpayPaymentFailureDto } from './dto/razorpay-payment-failure.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('razorpay/verify')
  verifyRazorpayPayment(
    @CurrentUser() user: User,
    @Body() dto: VerifyRazorpayPaymentDto,
  ) {
    return this.payments.verifyCheckoutPayment(dto, user.id);
  }

  @Post('razorpay/failure')
  markRazorpayPaymentFailed(
    @CurrentUser() user: User,
    @Body() dto: RazorpayPaymentFailureDto,
  ) {
    return this.payments.markCheckoutPaymentFailed(dto, user.id);
  }

  @Public()
  @Post('razorpay/webhook')
  razorpayWebhook(
    @Req() request: Request,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const body = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(JSON.stringify(request.body ?? {}));
    return this.payments.handleWebhook(body, signature);
  }
}
