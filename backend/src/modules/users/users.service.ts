import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const userProfileSelect = {
  id: true,
  phone: true,
  email: true,
  name: true,
  businessName: true,
  businessType: true,
  gstNumber: true,
  isOnboardingCompleted: true,
  role: true,
  addresses: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(user: User) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: userProfileSelect,
    });
  }

  async updateProfile(user: User, dto: UpdateProfileDto) {
    if (dto.isOnboardingCompleted === true) {
      const address = await this.prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        select: { latitude: true, longitude: true },
      });
      if (!address) {
        throw new BadRequestException(
          'Add a delivery address before completing onboarding.',
        );
      }
      if (
        user.role === UserRole.BUYER &&
        !this.hasValidCoordinates(address.latitude, address.longitude)
      ) {
        throw new BadRequestException(
          'Pin your exact delivery location on the map before completing onboarding.',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.businessName !== undefined && {
          businessName: dto.businessName,
        }),
        ...(dto.businessType !== undefined && {
          businessType: dto.businessType,
        }),
        ...(dto.gstNumber !== undefined && { gstNumber: dto.gstNumber }),
        ...(dto.isOnboardingCompleted !== undefined && {
          isOnboardingCompleted: dto.isOnboardingCompleted,
        }),
      },
      select: userProfileSelect,
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    this.assertCoordinatePair(dto);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationAccuracyMeters: dto.locationAccuracyMeters,
          locationSource: dto.locationSource,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    this.assertCoordinatePair(dto);
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Address not found');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(dto.line1 !== undefined && { line1: dto.line1 }),
          ...(dto.line2 !== undefined && { line2: dto.line2 }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.pincode !== undefined && { pincode: dto.pincode }),
          ...(dto.latitude !== undefined && { latitude: dto.latitude }),
          ...(dto.longitude !== undefined && { longitude: dto.longitude }),
          ...(dto.locationAccuracyMeters !== undefined && {
            locationAccuracyMeters: dto.locationAccuracyMeters,
          }),
          ...(dto.locationSource !== undefined && {
            locationSource: dto.locationSource,
          }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Address not found');
    }
    await this.prisma.address.delete({ where: { id: addressId } });
    if (existing.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { id: 'asc' },
      });
      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { deleted: true };
  }

  async assertAddressOwned(userId: string, addressId: string) {
    const addr = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!addr) {
      throw new ForbiddenException('Address does not belong to the user');
    }
    return addr;
  }

  private assertCoordinatePair(dto: { latitude?: number; longitude?: number }) {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Both latitude and longitude are required for a pinned delivery location.',
      );
    }
  }

  private hasValidCoordinates(
    latitude: number | null,
    longitude: number | null,
  ) {
    return (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}
