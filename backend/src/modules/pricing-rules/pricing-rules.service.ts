import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PricingDiscountType,
  PricingRuleAuditAction,
  Prisma,
  Product,
  User,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';

export type PricingSource = 'BATCH' | 'SPECIAL';
export type BatchTierSnapshot = {
  minimumQuantity: number;
  pricePerUnit: number;
};

type PricingRule = {
  id: string;
  discountType: PricingDiscountType;
  discountValue: Prisma.Decimal;
  isActive: boolean;
};

type BatchPricingSnapshot = {
  id: string;
  batchNumber: number;
  sellingPrice: Prisma.Decimal;
  quantity: number;
  bulkTiers: unknown;
  createdAt: Date;
};

type ProductWithBatches = Product & {
  batches?: BatchPricingSnapshot[];
};

function decimalString(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function readBatchTiers(value: unknown): BatchTierSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (tier): tier is { minimumQuantity: unknown; pricePerUnit: unknown } =>
        !!tier && typeof tier === 'object',
    )
    .map((tier) => ({
      minimumQuantity: Math.floor(Number(tier.minimumQuantity)),
      pricePerUnit: Number(tier.pricePerUnit),
    }))
    .filter(
      (tier) =>
        Number.isInteger(tier.minimumQuantity) &&
        tier.minimumQuantity > 0 &&
        Number.isFinite(tier.pricePerUnit) &&
        tier.pricePerUnit >= 0,
    )
    .sort((a, b) => a.minimumQuantity - b.minimumQuantity);
}

function ruleSnapshot(rule: {
  id: string;
  discountType: PricingDiscountType;
  discountValue: Prisma.Decimal;
  isActive: boolean;
  adminNote: string | null;
}): Prisma.InputJsonValue {
  return {
    id: rule.id,
    discountType: rule.discountType,
    discountValue: decimalString(rule.discountValue),
    isActive: rule.isActive,
    adminNote: rule.adminNote,
  };
}

function applySpecialDiscount(
  unitPrice: Prisma.Decimal,
  rule: PricingRule,
): Prisma.Decimal {
  if (rule.discountType === PricingDiscountType.PERCENT_OFF) {
    return unitPrice.mul(
      new Prisma.Decimal(100).minus(rule.discountValue).div(100),
    );
  }
  const next = unitPrice.minus(rule.discountValue);
  return next.lt(0) ? new Prisma.Decimal(0) : next;
}

@Injectable()
export class PricingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private activeRuleMap(
    user: User | null | undefined,
    productIds: string[],
  ): Promise<Map<string, PricingRule>> {
    if (!user || !user.roles.includes(UserRole.BUYER) || productIds.length === 0) {
      return Promise.resolve(new Map<string, PricingRule>());
    }
    return this.prisma.userProductPricingRule
      .findMany({
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
          isActive: true,
        },
      })
      .then((rules) => {
        const map = new Map<string, PricingRule>();
        for (const rule of rules) {
          map.set(rule.productId, {
            id: rule.id,
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            isActive: rule.isActive,
          });
        }
        return map;
      });
  }

  async decorateProductsForUser<T extends ProductWithBatches>(
    user: User | null | undefined,
    products: T[],
  ) {
    const rules = await this.activeRuleMap(
      user,
      products.map((product) => product.id),
    );

    return products.map((product) => {
      const rule = rules.get(product.id);
      const activeBatches = (product.batches ?? []).filter(
        (batch) => batch.quantity > 0,
      );
      const activeBatch = activeBatches[0] ?? null;
      const totalAvailableQty = activeBatches.reduce(
        (n, b) => n + b.quantity,
        0,
      );
      const activeSellingPrice = activeBatch?.sellingPrice ?? null;
      const displayPrice =
        rule && activeSellingPrice
          ? applySpecialDiscount(activeSellingPrice, rule)
          : (activeSellingPrice ?? new Prisma.Decimal(0));
      const pricingSource: PricingSource = rule ? 'SPECIAL' : 'BATCH';
      return {
        ...product,
        effectivePrice: displayPrice,
        pricingSource,
        activeSellingPrice: activeSellingPrice
          ? decimalString(activeSellingPrice)
          : null,
        hasMultipleBatches: activeBatches.length > 1,
        totalAvailableQty,
        batches: activeBatches.map((batch) => ({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          sellingPrice: decimalString(batch.sellingPrice),
          quantity: batch.quantity,
          bulkTiers: readBatchTiers(batch.bulkTiers),
          createdAt: batch.createdAt.toISOString(),
        })),
        specialPricing:
          rule && activeSellingPrice
            ? {
                label: 'Special price for you',
                discountType: rule.discountType,
                discountValue: decimalString(rule.discountValue),
                originalPrice: decimalString(activeSellingPrice),
                effectivePrice: decimalString(displayPrice),
              }
            : null,
      };
    });
  }

  private async assertBuyerAndProduct(userId: string, productId: string) {
    const [buyer, product] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!buyer || !buyer.roles.includes(UserRole.BUYER)) {
      throw new NotFoundException('Buyer not found');
    }
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return { buyer, product };
  }

  /**
   * Validate the raw discount value. The old per-product `basePrice` floor is
   * gone — we now reject negative/zero PERCENT_OFF and out-of-range values.
   * AMOUNT_OFF beneath the live batch price is enforced at order time
   * (by clamping the final unit price to 0).
   */
  private validateDiscount(
    discountType: PricingDiscountType,
    rawValue: number,
  ): Prisma.Decimal {
    const discountValue = new Prisma.Decimal(rawValue);
    if (
      discountType === PricingDiscountType.PERCENT_OFF &&
      (discountValue.lte(0) || discountValue.gte(100))
    ) {
      throw new BadRequestException(
        'Percent discount must be between 0 and 100',
      );
    }
    if (
      discountType === PricingDiscountType.AMOUNT_OFF &&
      discountValue.lte(0)
    ) {
      throw new BadRequestException('Amount discount must be greater than 0');
    }
    return discountValue;
  }

  async listForUser(userId: string) {
    const buyer = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!buyer || !buyer.roles.includes(UserRole.BUYER)) {
      throw new NotFoundException('Buyer not found');
    }
    return this.prisma.userProductPricingRule.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        product: { include: { batches: true } },
        updatedByAdmin: {
          select: { id: true, email: true, name: true, businessName: true },
        },
      },
    });
  }

  async upsertForUserProduct(
    userId: string,
    productId: string,
    dto: UpsertPricingRuleDto,
    admin: User,
  ) {
    await this.assertBuyerAndProduct(userId, productId);
    const discountValue = this.validateDiscount(
      dto.discountType,
      dto.discountValue,
    );
    const existing = await this.prisma.userProductPricingRule.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    return this.prisma.$transaction(async (tx) => {
      const rule = existing
        ? await tx.userProductPricingRule.update({
            where: { id: existing.id },
            data: {
              discountType: dto.discountType,
              discountValue,
              isActive: true,
              adminNote: dto.adminNote ?? null,
              updatedByAdminId: admin.id,
            },
          })
        : await tx.userProductPricingRule.create({
            data: {
              userId,
              productId,
              discountType: dto.discountType,
              discountValue,
              isActive: true,
              adminNote: dto.adminNote ?? null,
              createdByAdminId: admin.id,
              updatedByAdminId: admin.id,
            },
          });

      await tx.userProductPricingAudit.create({
        data: {
          ruleId: rule.id,
          userId,
          productId,
          changedByAdminId: admin.id,
          action: existing
            ? PricingRuleAuditAction.UPDATED
            : PricingRuleAuditAction.CREATED,
          oldValue: existing ? ruleSnapshot(existing) : Prisma.JsonNull,
          newValue: ruleSnapshot(rule),
          reason: dto.reason,
        },
      });

      return tx.userProductPricingRule.findUnique({
        where: { id: rule.id },
        include: { product: { include: { batches: true } } },
      });
    });
  }

  async setRuleActive(
    ruleId: string,
    isActive: boolean,
    reason: string,
    admin: User,
  ) {
    const existing = await this.prisma.userProductPricingRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) {
      throw new NotFoundException('Pricing rule not found');
    }
    if (existing.isActive === isActive) {
      return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.userProductPricingRule.update({
        where: { id: ruleId },
        data: { isActive, updatedByAdminId: admin.id },
      });
      await tx.userProductPricingAudit.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          productId: rule.productId,
          changedByAdminId: admin.id,
          action: isActive
            ? PricingRuleAuditAction.ENABLED
            : PricingRuleAuditAction.DISABLED,
          oldValue: ruleSnapshot(existing),
          newValue: ruleSnapshot(rule),
          reason,
        },
      });
      return rule;
    });
  }

  auditForRule(ruleId: string) {
    return this.prisma.userProductPricingAudit.findMany({
      where: { ruleId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedByAdmin: {
          select: { id: true, email: true, name: true, businessName: true },
        },
      },
    });
  }
}
