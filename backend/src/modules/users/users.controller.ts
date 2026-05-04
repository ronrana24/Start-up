import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.users.getProfile(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }

  @Get('me/addresses')
  listAddresses(@CurrentUser() user: User) {
    return this.users.listAddresses(user.id);
  }

  @Post('me/addresses')
  createAddress(@CurrentUser() user: User, @Body() dto: CreateAddressDto) {
    return this.users.createAddress(user.id, dto);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.users.updateAddress(user.id, id, dto);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: User, @Param('id') id: string) {
    return this.users.deleteAddress(user.id, id);
  }
}
