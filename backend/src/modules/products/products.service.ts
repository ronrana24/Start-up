import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductCategory, User, UserRole } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import {
  createClient,
  SupabaseClient,
  type WebSocketLikeConstructor,
} from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import WebSocket from 'ws';
import { PrismaService } from '../../prisma/prisma.service';
import { PricingRulesService } from '../pricing-rules/pricing-rules.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductImageUploadCandidateDto } from './dto/prepare-product-image-uploads.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const minProductImages = 4;
const maxProductImages = 10;
const maxProductImageBytes = 8 * 1024 * 1024;
const productImageCacheControlSeconds = '31536000';
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
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly pricingRules: PricingRulesService,
    private readonly inventory: InventoryService,
  ) {}

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

  private assertProductImageCount(imageUrls: string[]) {
    if (imageUrls.length < minProductImages) {
      throw new BadRequestException(
        `Add at least ${minProductImages} product images.`,
      );
    }
    if (imageUrls.length > maxProductImages) {
      throw new BadRequestException(
        `You can add up to ${maxProductImages} product images.`,
      );
    }
  }

  private imageExtension(file: ProductImageUploadCandidateDto): string {
    const byMime = allowedImageMimeTypes.get(file.contentType);
    if (byMime) return byMime;
    const byName = extname(file.originalName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(byName)) {
      return byName === '.jpeg' ? '.jpg' : byName;
    }
    throw new BadRequestException(
      'Only JPG, PNG, WEBP, and GIF product images are allowed',
    );
  }

  private storageBucket(): string {
    return this.config.get<string>('storage.supabase.bucket') ?? 'Images';
  }

  private supabaseClient(): SupabaseClient {
    if (this.supabase) {
      return this.supabase;
    }
    const url = this.config.get<string>('storage.supabase.url') ?? '';
    const secretKey =
      this.config.get<string>('storage.supabase.secretKey') ?? '';
    if (!url || !secretKey) {
      throw new InternalServerErrorException(
        'Image storage is not configured.',
      );
    }
    this.supabase = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        transport: WebSocket as unknown as WebSocketLikeConstructor,
      },
    });
    return this.supabase;
  }

  async prepareImageUploads(files: ProductImageUploadCandidateDto[]): Promise<{
    uploads: Array<{
      originalName: string;
      bucket: string;
      path: string;
      signedUrl: string;
      token: string;
      publicUrl: string;
      contentType: string;
      cacheControl: string;
    }>;
  }> {
    if (files.length === 0) {
      throw new BadRequestException('At least one product image is required');
    }
    if (files.length > maxProductImages) {
      throw new BadRequestException(
        `You can upload up to ${maxProductImages} product images.`,
      );
    }

    const preparedFiles = files.map((file, index) => {
      if (!file.size || file.size <= 0) {
        throw new BadRequestException('Uploaded image file is empty');
      }
      if (file.size > maxProductImageBytes) {
        throw new BadRequestException(
          'Product images must be 8 MB or smaller.',
        );
      }
      const extension = this.imageExtension(file);
      return {
        file,
        path: `products/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${index + 1}${extension}`,
      };
    });

    const bucket = this.storageBucket();
    const storage = this.supabaseClient().storage.from(bucket);
    const uploads: Array<{
      originalName: string;
      bucket: string;
      path: string;
      signedUrl: string;
      token: string;
      publicUrl: string;
      contentType: string;
      cacheControl: string;
    }> = [];

    for (const { file, path } of preparedFiles) {
      const { data, error } = await storage.createSignedUploadUrl(path, {
        upsert: false,
      });
      if (error || !data) {
        throw new InternalServerErrorException(
          'Could not prepare product image upload.',
        );
      }
      const publicUrl = storage.getPublicUrl(path).data.publicUrl;
      uploads.push({
        originalName: file.originalName,
        bucket,
        path: data.path,
        signedUrl: data.signedUrl,
        token: data.token,
        publicUrl,
        contentType: file.contentType,
        cacheControl: productImageCacheControlSeconds,
      });
    }

    return { uploads };
  }

  private readonly productBatchInclude = {
    batches: {
      orderBy: [{ batchNumber: 'asc' as const }],
    },
  } satisfies Prisma.ProductInclude;

  async list(query: QueryProductsDto, user?: User) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ProductWhereInput = {};
    if (query.publicOnly || !canSeePrivateProducts(user)) {
      where.isPublic = true;
    }
    if (query.category) {
      where.category = query.category as ProductCategory;
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
        include: this.productBatchInclude,
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
      include: this.productBatchInclude,
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

  /**
   * Create a new product and its first inventory batch (batchNumber 1).
   * Pricing / stock now lives entirely on InventoryBatch so the initial
   * batch is what makes the product purchasable.
   */
  async create(dto: CreateProductDto) {
    const imageUrls = this.normalizeImageUrls(dto.imageUrls);
    this.assertProductImageCount(imageUrls);

    const initialBatchTiers = this.inventory.validateTiersForQuantity(
      dto.initialBatch.bulkTiers,
      dto.initialBatch.quantity,
    );

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          category: dto.category,
          unit: dto.unit,
          piecesPerPack:
            dto.unit === 'PACK' ? (dto.piecesPerPack ?? null) : null,
          isPublic: dto.isPublic ?? false,
          imageUrls,
        },
      });
      await tx.inventoryBatch.create({
        data: {
          productId: product.id,
          batchNumber: 1,
          costPrice: new Prisma.Decimal(dto.initialBatch.costPrice),
          sellingPrice: new Prisma.Decimal(dto.initialBatch.sellingPrice),
          quantity: dto.initialBatch.quantity,
          bulkTiers: initialBatchTiers as unknown as Prisma.InputJsonValue,
        },
      });
      return tx.product.findUnique({
        where: { id: product.id },
        include: this.productBatchInclude,
      });
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
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

    const imageUrls =
      dto.imageUrls === undefined
        ? undefined
        : this.normalizeImageUrls(dto.imageUrls);
    if (imageUrls !== undefined) {
      this.assertProductImageCount(imageUrls);
    }

    const data: Prisma.ProductUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.unit !== undefined && { unit: dto.unit }),
      piecesPerPack: nextPiecesPerPack,
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(imageUrls !== undefined && { imageUrls }),
    };

    await this.prisma.product.update({ where: { id }, data });
    return this.prisma.product.findUnique({
      where: { id },
      include: this.productBatchInclude,
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
