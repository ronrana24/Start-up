import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeliveryType, Product } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type BulkTier = { minQty: number; price: number };

export type PricedLine = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

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

  computeOrderTotals(
    lines: { product: Product; quantity: number }[],
    deliveryType: DeliveryType,
  ): {
    pricedLines: PricedLine[];
    subtotal: Prisma.Decimal;
    deliveryFee: Prisma.Decimal;
    total: Prisma.Decimal;
  } {
    const pricedLines: PricedLine[] = lines.map(({ product, quantity }) => {
      const unitPrice = this.lineUnitPrice(product, quantity);
      const lineTotal = unitPrice.mul(new Prisma.Decimal(quantity));
      return {
        productId: product.id,
        quantity,
        unitPrice,
        lineTotal,
      };
    });
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
