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

export type BulkTier = { minQty: number; price: number };
export type PricingSource = 'BASE' | 'BULK' | 'SPECIAL';

type PricingRule = {
  id: string;
  discountType: PricingDiscountType;
  discountValue: Prisma.Decimal;
  isActive: boolean;
};

type ProductWithPricingFields = Product & {
  inventory?: unknown;
};

export type ResolvedLinePrice = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  source: PricingSource;
  pricingSnapshot: Prisma.InputJsonValue;
};

function decimalString(value: Prisma.Decimal): string {
  return value.toFixed(2);
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

@Injectable()
export class PricingRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private activeRuleMap(
    user: User | null | undefined,
    productIds: string[],
  ): Promise<Map<string, PricingRule>> {
    if (!user || user.role !== UserRole.BUYER || productIds.length === 0) {
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

  private bulkUnitPrice(
    product: Product,
    quantity: number,
  ): { unitPrice: Prisma.Decimal; source: PricingSource; tier?: BulkTier } {
    const tiers = product.bulkPricingTiers as unknown;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return { unitPrice: product.basePrice, source: 'BASE' };
    }
    const sorted = [...(tiers as BulkTier[])].sort(
      (a, b) => b.minQty - a.minQty,
    );
    for (const tier of sorted) {
      if (quantity >= tier.minQty) {
        return {
          unitPrice: new Prisma.Decimal(tier.price),
          source: 'BULK',
          tier,
        };
      }
    }
    return { unitPrice: product.basePrice, source: 'BASE' };
  }

  private discountedUnitPrice(
    product: Product,
    rule: PricingRule,
  ): Prisma.Decimal {
    if (rule.discountType === PricingDiscountType.PERCENT_OFF) {
      return product.basePrice.mul(
        new Prisma.Decimal(100).minus(rule.discountValue).div(100),
      );
    }
    return product.basePrice.minus(rule.discountValue);
  }

  private resolveUnitPrice(
    product: Product,
    quantity: number,
    rule?: PricingRule,
  ): {
    unitPrice: Prisma.Decimal;
    source: PricingSource;
    pricingSnapshot: Prisma.InputJsonValue;
  } {
    if (rule?.isActive) {
      const unitPrice = this.discountedUnitPrice(product, rule);
      return {
        unitPrice,
        source: 'SPECIAL',
        pricingSnapshot: {
          source: 'SPECIAL',
          label: 'Special price for you',
          ruleId: rule.id,
          discountType: rule.discountType,
          discountValue: decimalString(rule.discountValue),
          basePrice: decimalString(product.basePrice),
          effectiveUnitPrice: decimalString(unitPrice),
          bulkPricingIgnored: true,
        },
      };
    }

    const resolved = this.bulkUnitPrice(product, quantity);
    return {
      unitPrice: resolved.unitPrice,
      source: resolved.source,
      pricingSnapshot: {
        source: resolved.source,
        basePrice: decimalString(product.basePrice),
        effectiveUnitPrice: decimalString(resolved.unitPrice),
        ...(resolved.tier
          ? {
              tierMinQty: resolved.tier.minQty,
              tierPrice: new Prisma.Decimal(resolved.tier.price).toFixed(2),
            }
          : {}),
      },
    };
  }

  async resolveOrderLines(
    user: User,
    lines: Array<{ product: Product; quantity: number }>,
  ): Promise<ResolvedLinePrice[]> {
    const rules = await this.activeRuleMap(
      user,
      lines.map((line) => line.product.id),
    );

    return lines.map(({ product, quantity }) => {
      const resolved = this.resolveUnitPrice(
        product,
        quantity,
        rules.get(product.id),
      );
      const lineTotal = resolved.unitPrice.mul(new Prisma.Decimal(quantity));
      return {
        productId: product.id,
        quantity,
        unitPrice: resolved.unitPrice,
        lineTotal,
        source: resolved.source,
        pricingSnapshot: resolved.pricingSnapshot,
      };
    });
  }

  async decorateProductsForUser<T extends ProductWithPricingFields>(
    user: User | null | undefined,
    products: T[],
  ) {
    const rules = await this.activeRuleMap(
      user,
      products.map((product) => product.id),
    );

    return products.map((product) => {
      const rule = rules.get(product.id);
      const resolved = this.resolveUnitPrice(product, 1, rule);
      return {
        ...product,
        effectivePrice: resolved.unitPrice,
        pricingSource: resolved.source,
        specialPricing: rule
          ? {
              label: 'Special price for you',
              discountType: rule.discountType,
              discountValue: decimalString(rule.discountValue),
              originalPrice: decimalString(product.basePrice),
              effectivePrice: decimalString(resolved.unitPrice),
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
    if (!buyer || buyer.role !== UserRole.BUYER) {
      throw new NotFoundException('Buyer not found');
    }
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return { buyer, product };
  }

  private validateDiscount(
    product: Product,
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
      product.basePrice.minus(discountValue).lte(0)
    ) {
      throw new BadRequestException(
        'Amount discount must keep price above zero',
      );
    }
    return discountValue;
  }

  async listForUser(userId: string) {
    const buyer = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!buyer || buyer.role !== UserRole.BUYER) {
      throw new NotFoundException('Buyer not found');
    }
    return this.prisma.userProductPricingRule.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        product: { include: { inventory: true } },
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
    const { product } = await this.assertBuyerAndProduct(userId, productId);
    const discountValue = this.validateDiscount(
      product,
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
        include: { product: { include: { inventory: true } } },
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
