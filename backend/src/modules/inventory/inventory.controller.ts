import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list() {
    return this.inventory.list();
  }

  @Get(':productId')
  getOne(@Param('productId') productId: string) {
    return this.inventory.getForProduct(productId);
  }

  @Patch(':productId')
  adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventory.adjustAvailable(productId, dto.availableQty);
  }
}
