import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PatchRiderLocationDto } from './dto/patch-rider-location.dto';
import { PatchRiderStatusDto } from './dto/patch-rider-status.dto';
import { RidersService } from './riders.service';

@Controller('riders')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class RidersController {
  constructor(private readonly riders: RidersService) {}

  @Get()
  list() {
    return this.riders.list();
  }

  @Patch(':id/status')
  patchStatus(@Param('id') id: string, @Body() dto: PatchRiderStatusDto) {
    return this.riders.patchStatus(id, dto);
  }

  @Patch(':id/location')
  patchLocation(@Param('id') id: string, @Body() dto: PatchRiderLocationDto) {
    return this.riders.patchLocation(id, dto);
  }
}
