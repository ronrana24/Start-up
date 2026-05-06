import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryType, Product, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';

export type BulkTier = { minQty: number; price: number };

export type PricedLine = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  pricingSnapshot: Prisma.InputJsonValue;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly config: ConfigService,
    private readonly pricingRules: PricingRulesService,
  ) {}

  lineUnitPrice(product: Product, quantity: number): Prisma.Decimal {
    const tiers = product.bulkPricingTiers as unknown;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return product.basePrice;
    }
    const sorted = [...(tiers as BulkTier[])].sort(
      (a, b) => b.minQty - a.minQty,
    );
    for (const t of sorted) {
      if (quantity >= t.minQty) {
        return new Prisma.Decimal(t.price);
      }
    }
    return product.basePrice;
  }

  assertMoq(subtotal: Prisma.Decimal): void {
    const moq = new Prisma.Decimal(
      this.config.get<number>('pricing.moqMinAmountInr') ?? 2000,
    );
    if (subtotal.lt(moq)) {
      throw new BadRequestException(
        `Minimum order value is ₹${moq.toFixed(2)} (pre-delivery)`,
      );
    }
  }

  deliveryFee(type: DeliveryType, subtotal: Prisma.Decimal): Prisma.Decimal {
    if (type === DeliveryType.STANDARD) {
      return new Prisma.Decimal(
        this.config.get<number>('pricing.standardDeliveryFeeInr') ?? 0,
      );
    }
    const mult =
      this.config.get<number>('pricing.priorityDeliveryMultiplier') ?? 0.05;
    const minFee =
      this.config.get<number>('pricing.minPriorityDeliveryFeeInr') ?? 99;
    const raw = subtotal.mul(new Prisma.Decimal(mult));
    const minDec = new Prisma.Decimal(minFee);
    return raw.gt(minDec) ? raw : minDec;
  }

  async computeOrderTotals(
    user: User,
    lines: { product: Product; quantity: number }[],
    deliveryType: DeliveryType,
  ): Promise<{
    pricedLines: PricedLine[];
    subtotal: Prisma.Decimal;
    deliveryFee: Prisma.Decimal;
    total: Prisma.Decimal;
  }> {
    const pricedLines = await this.pricingRules.resolveOrderLines(user, lines);
    let subtotal = new Prisma.Decimal(0);
    for (const l of pricedLines) {
      subtotal = subtotal.add(l.lineTotal);
    }
    this.assertMoq(subtotal);
    const deliveryFee = this.deliveryFee(deliveryType, subtotal);
    const total = subtotal.add(deliveryFee);
    return { pricedLines, subtotal, deliveryFee, total };
  }
}
