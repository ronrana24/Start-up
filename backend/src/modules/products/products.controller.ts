import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { PrepareProductImageUploadsDto } from './dto/prepare-product-image-uploads.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(@CurrentUser() user: User, @Query() query: QueryProductsDto) {
    return this.products.list(query, user);
  }

  @Public()
  @Get(':id')
  getOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() query: QueryProductsDto,
  ) {
    return this.products.getById(id, user, query.publicOnly);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.products.hardDelete(id);
  }

  @Post('uploads')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  prepareImageUploads(@Body() dto: PrepareProductImageUploadsDto) {
    return this.products.prepareImageUploads(dto.files);
  }
}
