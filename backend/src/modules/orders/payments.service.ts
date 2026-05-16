import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CollectionStatus,
  Order,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryEventsService } from '../delivery/delivery-events.service';
import { DeliveryPushService } from '../delivery/delivery-push.service';
import { InventoryService } from '../inventory/inventory.service';

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  status?: string;
};

export type CheckoutPayment = {
  provider: 'razorpay';
  keyId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  demo: boolean;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly deliveryEvents: DeliveryEventsService,
    private readonly deliveryPush: DeliveryPushService,
    private readonly inventory: InventoryService,
  ) {}

  partialThreshold(): Prisma.Decimal {
    return new Prisma.Decimal(
      this.config.get<number>('payments.partialPaymentThresholdInr') ?? 5000,
    );
  }

  partialPercent(): Prisma.Decimal {
    return new Prisma.Decimal(
      this.config.get<number>('payments.partialPaymentPercent') ?? 20,
    );
  }

  isPartialEligible(total: Prisma.Decimal): boolean {
    return total.gt(this.partialThreshold());
  }

  partialAmount(total: Prisma.Decimal): Prisma.Decimal {
    return total
      .mul(this.partialPercent())
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_UP);
  }

  paymentSummaryForCreate(total: Prisma.Decimal, partial: boolean) {
    if (partial && !this.isPartialEligible(total)) {
      throw new BadRequestException(
        `Partial payment is available only for orders above ₹${this.partialThreshold().toFixed(2)}.`,
      );
    }
    const paidNow = partial ? this.partialAmount(total) : total;
    const dueAmount = total.sub(paidNow).toDecimalPlaces(2);
    return {
      paymentMode: partial ? PaymentMode.PARTIAL_UPI : PaymentMode.UPI,
      paidNow,
      dueAmount,
      paymentCollectionRequired: dueAmount.gt(0),
      collectionStatus: dueAmount.gt(0)
        ? CollectionStatus.PENDING
        : CollectionStatus.NOT_REQUIRED,
      collectionInstructions: dueAmount.gt(0)
        ? `Collect ₹${dueAmount.toFixed(2)} at delivery. Cash exception is allowed and must be recorded in the rider app.`
        : null,
    };
  }

  async createCheckoutPayment(order: Order, amount: Prisma.Decimal) {
    const amountPaise = this.toPaise(amount);
    const keyId = this.config.get<string>('payments.razorpay.keyId') ?? '';
    const keySecret =
      this.config.get<string>('payments.razorpay.keySecret') ?? '';
    const demo = !keyId || !keySecret;
    const receipt = `order_${order.id.slice(0, 32)}`;
    const razorpayOrderId = demo
      ? `order_demo_${order.id}`
      : await this.createRazorpayOrder(keyId, keySecret, {
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: { orderId: order.id },
        });

    await this.prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        razorpayOrderId,
        amount,
        status: PaymentStatus.PENDING,
        idempotencyKey: `checkout:${order.id}:${razorpayOrderId}`,
        metadata: {
          paymentMode: order.paymentMode,
          receipt,
          demo,
        },
      },
    });

    await this.audit(order.id, 'PAYMENT_ORDER_CREATED', {
      message: demo
        ? 'Demo Razorpay payment order created.'
        : 'Razorpay payment order created.',
      amount,
      nextStatus: PaymentStatus.PENDING,
      metadata: { razorpayOrderId, demo },
    });

    return {
      provider: 'razorpay',
      keyId: keyId || 'rzp_test_demo',
      razorpayOrderId,
      amountPaise,
      currency: 'INR',
      name: 'Grove',
      description:
        order.paymentMode === PaymentMode.PARTIAL_UPI
          ? 'Partial UPI payment'
          : 'UPI payment',
      demo,
    } satisfies CheckoutPayment;
  }

  async verifyCheckoutPayment(
    input: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
    userId?: string,
  ) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!transaction) {
      throw new BadRequestException('Payment order was not found.');
    }
    if (userId && transaction.order.userId !== userId) {
      throw new BadRequestException('Payment order was not found.');
    }
    if (transaction.status === PaymentStatus.PAID) {
      return transaction.order;
    }

    const demo = input.razorpayOrderId.startsWith('order_demo_');
    if (!demo && !this.verifyPaymentSignature(input)) {
      throw new UnauthorizedException('Payment verification failed.');
    }

    return this.markTransactionPaid(transaction.id, input.razorpayPaymentId, {
      source: demo ? 'demo_verification' : 'client_verification',
    });
  }

  async markCheckoutPaymentFailed(
    input: {
      razorpayOrderId: string;
      razorpayPaymentId?: string;
      errorCode?: string;
      errorDescription?: string;
    },
    userId?: string,
  ) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!transaction || transaction.status === PaymentStatus.PAID) {
      return transaction?.order ?? null;
    }
    if (userId && transaction.order.userId !== userId) {
      throw new BadRequestException('Payment order was not found.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.FAILED,
          razorpayPaymentId: input.razorpayPaymentId,
          errorCode: input.errorCode,
          errorDescription: input.errorDescription,
        },
      });
      const shouldCancel =
        transaction.order.status !== OrderStatus.CANCELLED &&
        transaction.order.status !== OrderStatus.DELIVERED;
      if (shouldCancel) {
        for (const item of transaction.order.items) {
          await this.inventory.releaseReservationInTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }
      }
      const updatedOrder = await tx.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          ...(shouldCancel ? { status: OrderStatus.CANCELLED } : {}),
        },
        include: {
          items: { include: { product: true } },
          rider: true,
          user: true,
        },
      });
      await tx.paymentAudit.create({
        data: {
          orderId: transaction.orderId,
          eventType: 'PAYMENT_FAILED',
          message: 'Buyer payment attempt failed.',
          previousStatus: transaction.order.paymentStatus,
          nextStatus: PaymentStatus.FAILED,
          metadata: {
            razorpayOrderId: input.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            errorCode: input.errorCode,
            errorDescription: input.errorDescription,
          },
        },
      });
      return updatedOrder;
    });
    this.deliveryEvents.orderStatusChanged(updated);
    return updated;
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret =
      this.config.get<string>('payments.razorpay.webhookSecret') ?? '';
    if (secret && !this.verifyRawSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid payment webhook signature.');
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
      };
    };
    const payment = payload.payload?.payment?.entity;
    const eventType = payload.event ?? 'unknown';
    const eventId = payment?.id
      ? `${eventType}:${payment.id}`
      : rawBody.toString('base64url').slice(0, 120);

    const created = await this.prisma.paymentWebhookEvent
      .create({
        data: {
          eventId,
          eventType,
          payload: payload as Prisma.InputJsonValue,
        },
      })
      .catch(() => null);
    if (!created) {
      return { received: true, duplicate: true };
    }

    if (
      payment?.order_id &&
      payment.id &&
      (eventType === 'payment.captured' || payment.status === 'captured')
    ) {
      const transaction = await this.prisma.paymentTransaction.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });
      if (transaction && transaction.status !== PaymentStatus.PAID) {
        await this.markTransactionPaid(transaction.id, payment.id, {
          source: 'webhook',
          eventType,
        });
      }
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });
    return { received: true };
  }

  private async markTransactionPaid(
    transactionId: string,
    razorpayPaymentId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { order: true },
      });
      if (!transaction) {
        throw new BadRequestException('Payment transaction was not found.');
      }
      if (transaction.status === PaymentStatus.PAID) {
        return transaction.order;
      }

      const paidAmount = transaction.order.paidAmount.add(transaction.amount);
      const dueAmount = transaction.order.totalAmount
        .sub(paidAmount)
        .toDecimalPlaces(2);
      const paymentStatus = dueAmount.gt(0)
        ? PaymentStatus.PARTIALLY_PAID
        : PaymentStatus.PAID;

      await tx.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: PaymentStatus.PAID,
          razorpayPaymentId,
          metadata,
        },
      });

      const order = await tx.order.update({
        where: { id: transaction.orderId },
        data: {
          paidAmount,
          dueAmount,
          paymentStatus,
          paymentCollectionRequired: dueAmount.gt(0),
          collectionStatus: dueAmount.gt(0)
            ? CollectionStatus.PENDING
            : CollectionStatus.NOT_REQUIRED,
        },
        include: {
          items: { include: { product: true } },
          rider: true,
          user: true,
        },
      });

      await tx.paymentAudit.create({
        data: {
          orderId: order.id,
          eventType: 'PAYMENT_CAPTURED',
          message: 'Buyer UPI payment confirmed.',
          amount: transaction.amount,
          previousStatus: transaction.order.paymentStatus,
          nextStatus: paymentStatus,
          metadata,
        },
      });

      return order;
    });
    this.deliveryEvents.orderCreated(order);
    void this.deliveryPush.notifyAvailableRiders(order);
    return order;
  }

  private async createRazorpayOrder(
    keyId: string,
    keySecret: string,
    body: {
      amount: number;
      currency: string;
      receipt: string;
      notes: Record<string, string>;
    },
  ) {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new InternalServerErrorException(
        'Could not create UPI payment order. Please try again.',
      );
    }
    const payload = (await response.json()) as RazorpayOrderResponse;
    return payload.id;
  }

  private verifyPaymentSignature(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const secret = this.config.get<string>('payments.razorpay.keySecret') ?? '';
    if (!secret) {
      return false;
    }
    const expected = createHmac('sha256', secret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest('hex');
    return this.safeEqual(expected, input.razorpaySignature);
  }

  private verifyRawSignature(
    rawBody: Buffer,
    signature: string | undefined,
    secret: string,
  ) {
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.safeEqual(expected, signature);
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private toPaise(amount: Prisma.Decimal) {
    return Number(amount.mul(100).toDecimalPlaces(0).toString());
  }

  private audit(
    orderId: string,
    eventType: string,
    input: {
      message: string;
      amount?: Prisma.Decimal;
      previousStatus?: string;
      nextStatus?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.paymentAudit.create({
      data: {
        orderId,
        eventType,
        message: input.message,
        amount: input.amount,
        previousStatus: input.previousStatus,
        nextStatus: input.nextStatus,
        metadata: input.metadata,
      },
    });
  }
}
