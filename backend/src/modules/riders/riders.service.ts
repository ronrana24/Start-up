import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PatchRiderLocationDto } from './dto/patch-rider-location.dto';
import { PatchRiderStatusDto } from './dto/patch-rider-status.dto';

@Injectable()
export class RidersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.rider.findMany({ orderBy: { name: 'asc' } });
  }

  async patchStatus(id: string, dto: PatchRiderStatusDto) {
    const existing = await this.prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rider not found');
    }
    return this.prisma.rider.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async patchLocation(id: string, dto: PatchRiderLocationDto) {
    const existing = await this.prisma.rider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rider not found');
    }
    return this.prisma.rider.update({
      where: { id },
      data: { currentLocation: { lat: dto.lat, lng: dto.lng } },
    });
  }
}
