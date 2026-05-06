import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

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

  async getById(id: string, user?: User) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!product) {
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
}
