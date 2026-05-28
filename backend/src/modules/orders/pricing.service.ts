import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryType,
  PricingDiscountType,
  Product,
  User,
  UserRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  BatchAllocation,
  InventoryService,
} from '../inventory/inventory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';

type ActiveSpecialRule = {
  id: string;
  productId: string;
  discountType: PricingDiscountType;
  discountValue: Prisma.Decimal;
};

export type PricedBatchSegment = {
  batchId: string;
  batchNumber: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

export type PricedLine = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  batches: PricedBatchSegment[];
  hasMixedBatches: boolean;
  pricingSnapshot: Prisma.InputJsonValue;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly config: ConfigService,
    private readonly pricingRules: PricingRulesService,
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  private applySpecialRule(
    unitPrice: Prisma.Decimal,
    rule: ActiveSpecialRule | undefined,
  ): Prisma.Decimal {
    if (!rule) return unitPrice;
    if (rule.discountType === PricingDiscountType.PERCENT_OFF) {
      return unitPrice.mul(
        new Prisma.Decimal(100).minus(rule.discountValue).div(100),
      );
    }
    const next = unitPrice.minus(rule.discountValue);
    return next.lt(0) ? new Prisma.Decimal(0) : next;
  }

  private async activeRulesForUser(
    user: User | null | undefined,
    productIds: string[],
  ): Promise<Map<string, ActiveSpecialRule>> {
    if (
      !user ||
      !user.roles.includes(UserRole.BUYER) ||
      productIds.length === 0
    ) {
      return new Map();
    }
    const rules = await this.prisma.userProductPricingRule.findMany({
      where: {
        userId: user.id,
        productId: { in: productIds },
        isActive: true,
      },
      select: {
        id: true,
        productId: true,
        discountType: true,
        discountValue: true,
      },
    });
    return new Map(rules.map((r) => [r.productId, r]));
  }

  // MOQ enforcement was removed so buyers can place orders of any size.
  // Small orders are covered by the delivery-fee schedule below (flat ₹30
  // standard fee under the free-delivery threshold + ₹21 priority surcharge).

  /** Standard delivery fee: flat below the threshold, free at or above it. */
  private standardDeliveryFee(subtotal: Prisma.Decimal): Prisma.Decimal {
    const threshold = new Prisma.Decimal(
      this.config.get<number>('pricing.freeDeliveryThresholdInr') ?? 500,
    );
    if (subtotal.gte(threshold)) return new Prisma.Decimal(0);
    return new Prisma.Decimal(
      this.config.get<number>('pricing.standardDeliveryFeeInr') ?? 30,
    );
  }

  /** Flat surcharge added on top of the standard fee for PRIORITY delivery. */
  priorityDeliverySurcharge(): Prisma.Decimal {
    return new Prisma.Decimal(
      this.config.get<number>('pricing.priorityDeliverySurchargeInr') ?? 21,
    );
  }

  deliveryFee(type: DeliveryType, subtotal: Prisma.Decimal): Prisma.Decimal {
    const base = this.standardDeliveryFee(subtotal);
    if (type === DeliveryType.PRIORITY) {
      return base.add(this.priorityDeliverySurcharge());
    }
    return base;
  }

  /**
   * Pick the unit price for `batch` given a total line quantity. Each batch
   * owns its own tier table (`{ minimumQuantity, pricePerUnit }[]`); we pick
   * the highest matching tier, falling back to the batch's `sellingPrice`.
   */
  private batchUnitPriceForQuantity(
    batch: BatchAllocation,
    totalLineQty: number,
  ): Prisma.Decimal {
    const tiers = batch.bulkTiers;
    if (tiers.length === 0) return batch.unitPrice;
    const sorted = [...tiers].sort(
      (a, b) => b.minimumQuantity - a.minimumQuantity,
    );
    for (const tier of sorted) {
      if (totalLineQty >= tier.minimumQuantity) {
        return new Prisma.Decimal(tier.pricePerUnit);
      }
    }
    return batch.unitPrice;
  }

  private pricedLineFromAllocation(
    productId: string,
    quantity: number,
    allocations: BatchAllocation[],
    rule: ActiveSpecialRule | undefined,
  ): PricedLine {
    const segments: PricedBatchSegment[] = allocations.map((a) => {
      const tierUnitPrice = this.batchUnitPriceForQuantity(a, quantity);
      const unitPrice = this.applySpecialRule(tierUnitPrice, rule);
      return {
        batchId: a.batchId,
        batchNumber: a.batchNumber,
        quantity: a.quantity,
        unitPrice,
        lineTotal: unitPrice.mul(new Prisma.Decimal(a.quantity)),
      };
    });
    let lineTotal = new Prisma.Decimal(0);
    for (const seg of segments) {
      lineTotal = lineTotal.add(seg.lineTotal);
    }
    const blendedUnitPrice =
      quantity > 0 ? lineTotal.div(new Prisma.Decimal(quantity)) : lineTotal;
    const hasMixedBatches = segments.length > 1;
    const source = rule
      ? 'SPECIAL_BATCH'
      : hasMixedBatches
        ? 'BATCH_MIXED'
        : 'BATCH';
    const pricingSnapshot: Prisma.InputJsonValue = {
      source,
      blendedUnitPrice: blendedUnitPrice.toFixed(2),
      batches: segments.map((s) => ({
        batchId: s.batchId,
        batchNumber: s.batchNumber,
        quantity: s.quantity,
        unitPrice: s.unitPrice.toFixed(2),
        lineTotal: s.lineTotal.toFixed(2),
      })),
      ...(rule
        ? {
            specialRule: {
              ruleId: rule.id,
              discountType: rule.discountType,
              discountValue: rule.discountValue.toFixed(2),
            },
          }
        : {}),
    };
    return {
      productId,
      quantity,
      unitPrice: blendedUnitPrice,
      lineTotal,
      batches: segments,
      hasMixedBatches,
      pricingSnapshot,
    };
  }

  /**
   * Build a priced line for a single product based on current FIFO allocation
   * across active inventory batches. Does not mutate any rows.
   */
  async planBatchedLine(
    productId: string,
    quantity: number,
    rule?: ActiveSpecialRule,
  ): Promise<PricedLine> {
    const allocations = await this.inventory.planAllocation(
      productId,
      quantity,
    );
    return this.pricedLineFromAllocation(
      productId,
      quantity,
      allocations,
      rule,
    );
  }

  /**
   * Build priced lines and totals for an order using current batch FIFO
   * allocation. Used both for the cart "quote" preview and as the source
   * of truth at order placement time (the same allocations are committed
   * inside the order-creation transaction).
   */
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
    const rules = await this.activeRulesForUser(
      user,
      lines.map((l) => l.product.id),
    );
    const pricedLines: PricedLine[] = [];
    let subtotal = new Prisma.Decimal(0);
    for (const { product, quantity } of lines) {
      const priced = await this.planBatchedLine(
        product.id,
        quantity,
        rules.get(product.id),
      );
      pricedLines.push(priced);
      subtotal = subtotal.add(priced.lineTotal);
    }
    const deliveryFee = this.deliveryFee(deliveryType, subtotal);
    const total = subtotal.add(deliveryFee);
    return { pricedLines, subtotal, deliveryFee, total };
  }

  /**
   * Cart-screen preview: blended unit price + per-batch breakdown for the
   * caller's current cart. No MOQ enforced (used before checkout).
   */
  async quoteCart(
    user: User,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{
    lines: Array<{
      productId: string;
      quantity: number;
      blendedUnitPrice: string;
      lineTotal: string;
      hasMixedBatches: boolean;
      batches: Array<{
        batchId: string;
        batchNumber: number;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
      }>;
    }>;
    subtotal: string;
  }> {
    const rules = await this.activeRulesForUser(
      user,
      items.map((i) => i.productId),
    );
    let subtotal = new Prisma.Decimal(0);
    const lines = await Promise.all(
      items.map(async (item) => {
        const priced = await this.planBatchedLine(
          item.productId,
          item.quantity,
          rules.get(item.productId),
        );
        subtotal = subtotal.add(priced.lineTotal);
        return {
          productId: priced.productId,
          quantity: priced.quantity,
          blendedUnitPrice: priced.unitPrice.toFixed(2),
          lineTotal: priced.lineTotal.toFixed(2),
          hasMixedBatches: priced.hasMixedBatches,
          batches: priced.batches.map((b) => ({
            batchId: b.batchId,
            batchNumber: b.batchNumber,
            quantity: b.quantity,
            unitPrice: b.unitPrice.toFixed(2),
            lineTotal: b.lineTotal.toFixed(2),
          })),
        };
      }),
    );
    return { lines, subtotal: subtotal.toFixed(2) };
  }

  /**
   * Convert priced line allocations into the shape expected by
   * `InventoryService.reserveInTransaction` and the
   * `OrderItemBatchAllocation` persistence helpers.
   */
  allocationsForReservation(
    line: PricedLine,
  ): Array<{ batchId: string; quantity: number; unitPrice: Prisma.Decimal }> {
    return line.batches.map((b) => ({
      batchId: b.batchId,
      quantity: b.quantity,
      unitPrice: b.unitPrice,
    }));
  }

  /**
   * Build a PricedLine from a fresh set of FIFO allocations (e.g. produced
   * inside the order-creation transaction). Applies per-batch tier pricing
   * and any active special pricing rule, so the recorded snapshot stays
   * consistent even when FIFO allocations differ between quote-time and
   * place-time.
   */
  buildLineFromAllocations(
    productId: string,
    quantity: number,
    allocations: BatchAllocation[],
    rule: ActiveSpecialRule | undefined,
  ): PricedLine {
    return this.pricedLineFromAllocation(
      productId,
      quantity,
      allocations,
      rule,
    );
  }

  /** Active special rule lookup, exposed for callers that recompute pricing. */
  async resolveActiveRule(
    user: User,
    productId: string,
  ): Promise<ActiveSpecialRule | undefined> {
    const rules = await this.activeRulesForUser(user, [productId]);
    return rules.get(productId);
  }

  /** Read-only: rules accessor for callers that still need legacy resolution. */
  get rules(): PricingRulesService {
    return this.pricingRules;
  }
}
