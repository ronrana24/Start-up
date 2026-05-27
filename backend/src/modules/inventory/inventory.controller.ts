import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateInventoryBatchDto } from './dto/create-batch.dto';
import { UpdateInventoryBatchDto } from './dto/update-batch.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get(':productId/batches')
  listBatches(@Param('productId') productId: string) {
    return this.inventory.listAllBatches(productId);
  }

  @Post(':productId/batches')
  createBatch(
    @Param('productId') productId: string,
    @Body() dto: CreateInventoryBatchDto,
  ) {
    return this.inventory.addBatch(productId, {
      costPrice: dto.costPrice,
      sellingPrice: dto.sellingPrice,
      quantity: dto.quantity,
      bulkTiers: dto.bulkTiers,
    });
  }

  @Patch('batches/:batchId')
  updateBatch(
    @Param('batchId') batchId: string,
    @Body() dto: UpdateInventoryBatchDto,
  ) {
    return this.inventory.updateBatch(batchId, dto);
  }
}
