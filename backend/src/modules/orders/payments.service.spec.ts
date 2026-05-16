import { BadRequestException } from '@nestjs/common';
import { CollectionStatus, PaymentMode, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';

function makeService(config: Record<string, unknown> = {}) {
  return new PaymentsService(
    {} as never,
    {
      get: jest.fn((key: string) => config[key]),
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe(PaymentsService.name, () => {
  it('creates a full UPI payment summary below the partial threshold', () => {
    const service = makeService({
      'payments.partialPaymentThresholdInr': 5000,
      'payments.partialPaymentPercent': 20,
    });
    const total = new Prisma.Decimal(4500);

    const summary = service.paymentSummaryForCreate(total, false);

    expect(summary.paymentMode).toBe(PaymentMode.UPI);
    expect(summary.paidNow.eq(total)).toBe(true);
    expect(summary.dueAmount.eq(0)).toBe(true);
    expect(summary.paymentCollectionRequired).toBe(false);
    expect(summary.collectionStatus).toBe(CollectionStatus.NOT_REQUIRED);
  });

  it('rejects partial payment at the configured threshold boundary', () => {
    const service = makeService({
      'payments.partialPaymentThresholdInr': 5000,
      'payments.partialPaymentPercent': 20,
    });

    expect(() =>
      service.paymentSummaryForCreate(new Prisma.Decimal(5000), true),
    ).toThrow(BadRequestException);
  });

  it('calculates 20 percent upfront and delivery due for eligible partial orders', () => {
    const service = makeService({
      'payments.partialPaymentThresholdInr': 5000,
      'payments.partialPaymentPercent': 20,
    });

    const summary = service.paymentSummaryForCreate(
      new Prisma.Decimal(10000),
      true,
    );

    expect(summary.paymentMode).toBe(PaymentMode.PARTIAL_UPI);
    expect(summary.paidNow.eq(2000)).toBe(true);
    expect(summary.dueAmount.eq(8000)).toBe(true);
    expect(summary.paymentCollectionRequired).toBe(true);
    expect(summary.collectionStatus).toBe(CollectionStatus.PENDING);
    expect(summary.collectionInstructions).toContain('₹8000.00');
  });
});
