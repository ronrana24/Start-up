import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { ProductsService } from './products.service';

type UploadedProductImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: QueryProductsDto) {
    return this.products.list(query, user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.products.getById(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Post('uploads')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      limits: { fileSize: 8 * 1024 * 1024, files: 10 },
    }),
  )
  uploadImages(
    @UploadedFiles() files: UploadedProductImageFile[],
    @Req() request: Request,
  ) {
    return this.products.uploadImages(files ?? [], publicBaseUrl(request));
  }
}

function publicBaseUrl(request: Request): string {
  const forwardedProto = firstForwardedHeader(request.get('x-forwarded-proto'));
  const forwardedHost = firstForwardedHeader(request.get('x-forwarded-host'));
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get('host');
  return `${protocol}://${host}`;
}

function firstForwardedHeader(value: string | undefined): string | undefined {
  return value
    ?.split(',')
    .map((part) => part.trim())
    .find(Boolean);
}
