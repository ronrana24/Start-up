import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type UploadedProductImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const productImageUploadDir = join(process.cwd(), 'uploads', 'products');
const allowedImageMimeTypes = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

function canSeePrivateProducts(user?: User): boolean {
  return user?.role === UserRole.ADMIN;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pricingRules: PricingRulesService,
  ) {}

  private warehouseId(): string {
    return this.config.get<string>('warehouse.defaultId') ?? 'default';
  }

  private normalizeImageUrls(imageUrls: string[] | undefined) {
    const seen = new Set<string>();
    return (imageUrls ?? [])
      .map((url) => url.trim())
      .filter((url) => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });
  }

  private imageExtension(file: UploadedProductImageFile): string {
    const byMime = allowedImageMimeTypes.get(file.mimetype);
    if (byMime) return byMime;
    const byName = extname(file.originalname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(byName)) {
      return byName === '.jpeg' ? '.jpg' : byName;
    }
    throw new BadRequestException(
      'Only JPG, PNG, WEBP, and GIF product images are allowed',
    );
  }

  async uploadImages(
    files: UploadedProductImageFile[],
    publicBaseUrl: string,
  ): Promise<{ imageUrls: string[] }> {
    if (files.length === 0) {
      throw new BadRequestException('At least one product image is required');
    }
    await mkdir(productImageUploadDir, { recursive: true });
    const imageUrls: string[] = [];

    for (const file of files) {
      if (!file.buffer?.length) {
        throw new BadRequestException('Uploaded image file is empty');
      }
      const extension = this.imageExtension(file);
      const filename = `${randomUUID()}${extension}`;
      await writeFile(join(productImageUploadDir, filename), file.buffer, {
        flag: 'wx',
      });
      imageUrls.push(
        `${publicBaseUrl.replace(/\/+$/, '')}/uploads/products/${filename}`,
      );
    }

    return { imageUrls };
  }

  async list(query: QueryProductsDto, user?: User) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {};
    if (query.publicOnly || !canSeePrivateProducts(user)) {
      where.isPublic = true;
    }
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
    return {
      items: await this.pricingRules.decorateProductsForUser(user, items),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string, user?: User, publicOnly = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (
      !product ||
      ((publicOnly || !canSeePrivateProducts(user)) && !product.isPublic)
    ) {
      throw new NotFoundException('Product not found');
    }
    const [decorated] = await this.pricingRules.decorateProductsForUser(user, [
      product,
    ]);
    return decorated;
  }

  create(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          category: dto.category,
          unit: dto.unit,
          piecesPerPack:
            dto.unit === 'PACK' ? (dto.piecesPerPack ?? null) : null,
          isPublic: dto.isPublic ?? false,
          basePrice: new Prisma.Decimal(dto.basePrice),
          imageUrls: this.normalizeImageUrls(dto.imageUrls),
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

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const nextUnit = dto.unit ?? existing.unit;
    const nextPiecesPerPack =
      nextUnit === 'PACK'
        ? (dto.piecesPerPack ?? existing.piecesPerPack)
        : null;

    if (
      nextUnit === 'PACK' &&
      (!Number.isInteger(nextPiecesPerPack) || (nextPiecesPerPack ?? 0) < 1)
    ) {
      throw new BadRequestException('Pieces per pack is required for packs');
    }

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.ProductUpdateInput = {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        piecesPerPack: nextPiecesPerPack,
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
        ...(dto.basePrice !== undefined && {
          basePrice: new Prisma.Decimal(dto.basePrice),
        }),
        ...(dto.imageUrls !== undefined && {
          imageUrls: this.normalizeImageUrls(dto.imageUrls),
        }),
        ...(dto.bulkPricingTiers !== undefined && {
          bulkPricingTiers:
            dto.bulkPricingTiers as unknown as Prisma.InputJsonValue,
        }),
      };

      await tx.product.update({
        where: { id },
        data,
      });

      if (dto.initialAvailableQty !== undefined) {
        await tx.inventory.upsert({
          where: { productId: id },
          create: {
            productId: id,
            warehouseId: this.warehouseId(),
            availableQty: dto.initialAvailableQty,
            reservedQty: 0,
          },
          update: {
            availableQty: dto.initialAvailableQty,
          },
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: { inventory: true },
      });
    });
  }

  async hardDelete(id: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });
    if (orderItemCount > 0) {
      throw new BadRequestException(
        'Cannot hard delete a product that exists in orders. Make it private instead.',
      );
    }

    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
