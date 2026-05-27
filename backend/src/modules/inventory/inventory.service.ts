import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryBatch, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const INVENTORY_CONFLICT_MESSAGE =
  'Stock changed while you were checking out. Please review your cart and try again.';

function inventoryConflict(): ConflictException {
  return new ConflictException({
    code: 'CONFLICT',
    message: INVENTORY_CONFLICT_MESSAGE,
  });
}

export type Tx = Prisma.TransactionClient;

export type BatchBulkTier = {
  minimumQuantity: number;
  pricePerUnit: number;
};

export type BatchAllocation = {
  batchId: string;
  batchNumber: number;
  quantity: number;
  /** Batch's default unit price (sellingPrice); tier resolution is up to PricingService. */
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  bulkTiers: BatchBulkTier[];
  /** Optimistic-lock token snapshotted when the allocation was planned. */
  version: number;
};

export const MIN_BULK_TIERS = 1;
export const MAX_BULK_TIERS = 3;

function rawTiers(value: unknown): BatchBulkTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      minimumQuantity: Math.floor(Number(t.minimumQuantity)),
      pricePerUnit: Number(t.pricePerUnit),
    }))
    .filter(
      (t) =>
        Number.isInteger(t.minimumQuantity) &&
        t.minimumQuantity > 0 &&
        Number.isFinite(t.pricePerUnit) &&
        t.pricePerUnit >= 0,
    );
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active (non-empty) batches for a product, FIFO order (lowest batchNumber first). */
  listActiveBatches(productId: string) {
    return this.prisma.inventoryBatch.findMany({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { batchNumber: 'asc' },
    });
  }

  /** All batches (admin view), newest first. */
  listAllBatches(productId: string) {
    return this.prisma.inventoryBatch.findMany({
      where: { productId },
      orderBy: { batchNumber: 'desc' },
    });
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }
    return batch;
  }

  /**
   * The price a buyer sees today: the unit price of the oldest non-empty batch.
   * Returns null if the product has no stock.
   */
  async activeSellingPrice(productId: string): Promise<Prisma.Decimal | null> {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { batchNumber: 'asc' },
      select: { sellingPrice: true },
    });
    return batch?.sellingPrice ?? null;
  }

  /**
   * Buyer-facing snapshot used to render product cards + a local cart preview.
   */
  async pricingSnapshotForProduct(productId: string): Promise<{
    activeSellingPrice: string | null;
    hasMultipleBatches: boolean;
    totalAvailableQty: number;
    batches: Array<{
      batchId: string;
      batchNumber: number;
      sellingPrice: string;
      quantity: number;
      bulkTiers: BatchBulkTier[];
      createdAt: string;
    }>;
  }> {
    const batches = await this.listActiveBatches(productId);
    const totalAvailableQty = batches.reduce((n, b) => n + b.quantity, 0);
    return {
      activeSellingPrice: batches[0]?.sellingPrice.toFixed(2) ?? null,
      hasMultipleBatches: batches.length > 1,
      totalAvailableQty,
      batches: batches.map((b) => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        sellingPrice: b.sellingPrice.toFixed(2),
        quantity: b.quantity,
        bulkTiers: rawTiers(b.bulkTiers),
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  /** Plan FIFO allocation without mutating any rows. Used to preview cart pricing. */
  async planAllocation(
    productId: string,
    quantity: number,
  ): Promise<BatchAllocation[]> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    const batches = await this.listActiveBatches(productId);
    return this.allocateAcrossBatches(productId, quantity, batches);
  }

  private allocateAcrossBatches(
    productId: string,
    quantity: number,
    batches: InventoryBatch[],
  ): BatchAllocation[] {
    let remaining = quantity;
    const allocations: BatchAllocation[] = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.quantity);
      if (take <= 0) continue;
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: take,
        unitPrice: batch.sellingPrice,
        lineTotal: batch.sellingPrice.mul(new Prisma.Decimal(take)),
        bulkTiers: rawTiers(batch.bulkTiers),
        version: batch.version,
      });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new BadRequestException(
        `Insufficient available stock for product ${productId}`,
      );
    }
    return allocations;
  }

  /**
   * Validate, sort, and reject malformed tier lists. Per the spec:
   *   - at least 1 tier
   *   - at most 3 tiers
   *   - distinct minimumQuantity values
   *   - minimumQuantity ≤ batch quantity
   */
  validateTiersForQuantity(
    raw: Array<{ minimumQuantity: number; pricePerUnit: number }>,
    batchQuantity: number,
  ): BatchBulkTier[] {
    if (!Array.isArray(raw) || raw.length < MIN_BULK_TIERS) {
      throw new BadRequestException(
        `At least ${MIN_BULK_TIERS} bulk tier is required for a batch.`,
      );
    }
    if (raw.length > MAX_BULK_TIERS) {
      throw new BadRequestException(
        `A batch can have at most ${MAX_BULK_TIERS} bulk tiers.`,
      );
    }
    const cleaned: BatchBulkTier[] = [];
    for (const tier of raw) {
      if (
        !Number.isInteger(tier.minimumQuantity) ||
        tier.minimumQuantity < 1
      ) {
        throw new BadRequestException(
          'Tier minimumQuantity must be a positive integer.',
        );
      }
      if (!Number.isFinite(tier.pricePerUnit) || tier.pricePerUnit < 0) {
        throw new BadRequestException(
          'Tier pricePerUnit must be a non-negative number.',
        );
      }
      if (tier.minimumQuantity > batchQuantity) {
        throw new BadRequestException(
          `Tier minimumQuantity (${tier.minimumQuantity}) cannot exceed the batch's quantity (${batchQuantity}).`,
        );
      }
      cleaned.push({
        minimumQuantity: tier.minimumQuantity,
        pricePerUnit: tier.pricePerUnit,
      });
    }
    const sorted = [...cleaned].sort(
      (a, b) => a.minimumQuantity - b.minimumQuantity,
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.minimumQuantity === sorted[i - 1]!.minimumQuantity) {
        throw new BadRequestException(
          'Bulk tiers must use distinct minimumQuantity values.',
        );
      }
    }
    return sorted;
  }

  async addBatch(
    productId: string,
    input: {
      costPrice: number | string;
      sellingPrice: number | string;
      quantity: number;
      bulkTiers: Array<{ minimumQuantity: number; pricePerUnit: number }>;
    },
  ) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException(
        'Batch quantity must be a positive integer.',
      );
    }
    const costPrice = new Prisma.Decimal(input.costPrice);
    const sellingPrice = new Prisma.Decimal(input.sellingPrice);
    if (costPrice.lt(0) || sellingPrice.lt(0)) {
      throw new BadRequestException('Prices must be non-negative.');
    }
    const tiers = this.validateTiersForQuantity(input.bulkTiers, input.quantity);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      const lastBatch = await tx.inventoryBatch.findFirst({
        where: { productId },
        orderBy: { batchNumber: 'desc' },
        select: { batchNumber: true },
      });
      const nextBatchNumber = (lastBatch?.batchNumber ?? 0) + 1;
      return tx.inventoryBatch.create({
        data: {
          productId,
          batchNumber: nextBatchNumber,
          costPrice,
          sellingPrice,
          quantity: input.quantity,
          bulkTiers: tiers as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  async updateBatch(
    batchId: string,
    input: {
      costPrice?: number | string;
      sellingPrice?: number | string;
      quantity?: number;
      bulkTiers?: Array<{ minimumQuantity: number; pricePerUnit: number }>;
    },
  ) {
    const existing = await this.getBatch(batchId);
    const nextQuantity =
      input.quantity === undefined ? existing.quantity : input.quantity;
    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      throw new BadRequestException('Quantity must be a non-negative integer.');
    }
    const data: Prisma.InventoryBatchUpdateInput = {};
    if (input.costPrice !== undefined) {
      const value = new Prisma.Decimal(input.costPrice);
      if (value.lt(0))
        throw new BadRequestException('costPrice must be non-negative.');
      data.costPrice = value;
    }
    if (input.sellingPrice !== undefined) {
      const value = new Prisma.Decimal(input.sellingPrice);
      if (value.lt(0))
        throw new BadRequestException('sellingPrice must be non-negative.');
      data.sellingPrice = value;
    }
    if (input.quantity !== undefined) {
      data.quantity = input.quantity;
    }
    const rawForValidation =
      input.bulkTiers ?? (rawTiers(existing.bulkTiers) as BatchBulkTier[]);
    const validated = this.validateTiersForQuantity(rawForValidation, nextQuantity);
    if (input.bulkTiers !== undefined) {
      data.bulkTiers = validated as unknown as Prisma.InputJsonValue;
    }
    // Bump the optimistic-lock token so any in-flight checkout that planned
    // against the pre-edit row is rejected by the predicate-match in
    // `reserveInTransaction` and forced to retry against the fresh snapshot.
    data.version = { increment: 1 };
    return this.prisma.inventoryBatch.update({
      where: { id: batchId },
      data,
    });
  }

  /**
   * Decrement FIFO across batches inside a transaction using
   * **optimistic locking** — every update's WHERE clause includes the row's
   * snapshotted `version`. A concurrent buyer who already incremented the
   * version (e.g. they checked out a moment earlier) will fail our predicate
   * match. We translate that into a structured CONFLICT so the caller (and
   * ultimately the buyer) gets a friendly retry message.
   */
  async reserveInTransaction(
    tx: Tx,
    productId: string,
    quantity: number,
  ): Promise<BatchAllocation[]> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }
    const batches = await tx.inventoryBatch.findMany({
      where: { productId, quantity: { gt: 0 } },
      orderBy: { batchNumber: 'asc' },
    });
    const allocations = this.allocateAcrossBatches(productId, quantity, batches);
    for (const allocation of allocations) {
      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id: allocation.batchId,
          // Optimistic lock: only succeed if the row hasn't moved since we
          // read it, *and* there is still enough stock to satisfy this slice.
          version: allocation.version,
          quantity: { gte: allocation.quantity },
        },
        data: {
          quantity: { decrement: allocation.quantity },
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw inventoryConflict();
      }
    }
    return allocations;
  }

  /**
   * Restore quantity to the originating batches. Used when an order is
   * cancelled before delivery. After delivery the quantity stays decremented
   * (the goods have left the warehouse). Increments `version` so any
   * in-flight checkout that staged its update from the pre-restore snapshot
   * is rejected by the optimistic lock.
   */
  async restoreInTransaction(
    tx: Tx,
    allocations: Array<{ batchId: string; quantity: number }>,
  ): Promise<void> {
    for (const allocation of allocations) {
      await tx.inventoryBatch.update({
        where: { id: allocation.batchId },
        data: {
          quantity: { increment: allocation.quantity },
          version: { increment: 1 },
        },
      });
    }
  }
}
