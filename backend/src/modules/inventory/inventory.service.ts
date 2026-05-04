import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private warehouseId(): string {
    return this.config.get<string>('warehouse.defaultId') ?? 'default';
  }

  list() {
    return this.prisma.inventory.findMany({
      where: { warehouseId: this.warehouseId() },
      include: { product: true },
    });
  }

  async getForProduct(productId: string) {
    const row = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { product: true },
    });
    if (!row) {
      throw new NotFoundException('Inventory not found for product');
    }
    return row;
  }

  async adjustAvailable(productId: string, availableQty: number) {
    const inv = await this.prisma.inventory.findUnique({
      where: { productId },
    });
    if (!inv) {
      throw new NotFoundException('Inventory not found for product');
    }
    return this.prisma.inventory.update({
      where: { id: inv.id },
      data: { availableQty, version: { increment: 1 } },
    });
  }

  /**
   * Moves quantity from available to reserved. Fails the transaction if stock is insufficient.
   */
  async reserveInTransaction(
    tx: Tx,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const wid = this.warehouseId();
    const updated = await tx.inventory.updateMany({
      where: {
        productId,
        warehouseId: wid,
        availableQty: { gte: quantity },
      },
      data: {
        availableQty: { decrement: quantity },
        reservedQty: { increment: quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        `Insufficient available stock for product ${productId}`,
      );
    }
  }

  /**
   * On cancel before delivery: return reserved units back to available.
   */
  async releaseReservationInTransaction(
    tx: Tx,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const wid = this.warehouseId();
    const updated = await tx.inventory.updateMany({
      where: {
        productId,
        warehouseId: wid,
        reservedQty: { gte: quantity },
      },
      data: {
        availableQty: { increment: quantity },
        reservedQty: { decrement: quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        `Could not release reservation for product ${productId}`,
      );
    }
  }

  /**
   * On delivered: goods left the warehouse; reserved only is reduced (available was already decremented on reserve).
   */
  async consumeReservedInTransaction(
    tx: Tx,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const wid = this.warehouseId();
    const updated = await tx.inventory.updateMany({
      where: {
        productId,
        warehouseId: wid,
        reservedQty: { gte: quantity },
      },
      data: {
        reservedQty: { decrement: quantity },
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new BadRequestException(
        `Could not finalize reservation for product ${productId}`,
      );
    }
  }
}
