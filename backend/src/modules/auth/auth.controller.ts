import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleSendOtpDto } from './dto/google-send-otp.dto';
import { GoogleCompleteDto } from './dto/google-complete.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private authCookieOptions(): CookieOptions {
    const domain = this.config.get<string>('auth.cookie.domain');
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<boolean>('auth.cookie.secure'),
      sameSite: this.config.getOrThrow<'lax' | 'strict' | 'none'>(
        'auth.cookie.sameSite',
      ),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  private setAccessTokenCookie(res: Response, accessToken: string) {
    res.cookie(this.config.getOrThrow<string>('auth.cookie.name'), accessToken, {
      ...this.authCookieOptions(),
      maxAge: this.config.getOrThrow<number>('auth.cookie.maxAgeSeconds') * 1000,
    });
  }

  private clearAccessTokenCookie(res: Response) {
    res.clearCookie(
      this.config.getOrThrow<string>('auth.cookie.name'),
      this.authCookieOptions(),
    );
  }

  @Public()
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Public()
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const payload = await this.auth.verifyOtp(dto.phone, dto.code);
    this.setAccessTokenCookie(res, payload.accessToken);
    return payload;
  }

  @Public()
  @Post('google')
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.auth.loginWithGoogle(dto.idToken);
    if (payload.message === 'authenticated') {
      this.setAccessTokenCookie(res, payload.accessToken);
    }
    return payload;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ googleSendOtp: {} })
  @Post('google/send-otp')
  googleSendOtp(@Body() dto: GoogleSendOtpDto) {
    return this.auth.sendOtpForGoogleRegistration(
      dto.registrationToken,
      dto.phone,
    );
  }

  @Public()
  @Post('google/complete')
  async googleComplete(
    @Body() dto: GoogleCompleteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.auth.completeGoogleRegistration(
      dto.registrationToken,
      dto.phone,
      dto.code,
    );
    this.setAccessTokenCookie(res, payload.accessToken);
    return payload;
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearAccessTokenCookie(res);
    return { message: 'logged_out' };
  }
}
