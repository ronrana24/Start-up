import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private warehouseId(): string {
    return this.config.get<string>('warehouse.defaultId') ?? 'default';
  }

  async list(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {};
    if (query.category) {
      where.category = query.category;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: { inventory: true },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          category: dto.category,
          unit: dto.unit,
          basePrice: new Prisma.Decimal(dto.basePrice),
          bulkPricingTiers:
            dto.bulkPricingTiers as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.inventory.create({
        data: {
          productId: product.id,
          warehouseId: this.warehouseId(),
          availableQty: dto.initialAvailableQty ?? 0,
          reservedQty: 0,
        },
      });
      return tx.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
    });
  }
}
