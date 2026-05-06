import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { SMS_SERVICE } from './sms/sms.service';
import type { SmsService } from './sms/sms.service';
import {
  GoogleProfile,
  GoogleVerifierService,
} from './google/google-verifier.service';
import { StringValue } from 'ms';

const REGISTRATION_TOKEN_PURPOSE = 'google_registration';

interface RegistrationTokenPayload {
  purpose: typeof REGISTRATION_TOKEN_PURPOSE;
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export type GoogleLoginResult =
  | { message: 'authenticated'; accessToken: string; user: AuthUser }
  | {
      message: 'needs_phone';
      registrationToken: string;
      profile: { email: string; name?: string; picture?: string };
    };

export type AuthUser = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  businessName: string;
  businessType: string;
  gstNumber: string | null;
  isOnboardingCompleted: boolean;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_SERVICE) private readonly sms: SmsService,
    private readonly googleVerifier: GoogleVerifierService,
  ) {}

  normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException('Invalid phone number');
    }
    return `+${digits}`;
  }

  private generateOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async issueOtp(phone: string): Promise<{ expiresInSeconds: number }> {
    const ttl = this.config.getOrThrow<number>('otp.ttlSeconds');
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const code = this.generateOtpCode();
    const pepper = this.config.getOrThrow<string>('otp.pepper');
    const codeHash = await bcrypt.hash(code + pepper, 10);

    await this.prisma.otpChallenge.create({
      data: { phone, codeHash, expiresAt },
    });

    await this.sms.sendOtp(phone, code);
    return { expiresInSeconds: ttl };
  }

  private async consumeOtp(phone: string, code: string): Promise<void> {
    const maxAttempts = this.config.getOrThrow<number>('otp.maxAttempts');
    const pepper = this.config.getOrThrow<string>('otp.pepper');

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        phone,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    if (challenge.attempts >= maxAttempts) {
      throw new UnauthorizedException('Too many OTP attempts');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

    const ok = await bcrypt.compare(code + pepper, challenge.codeHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid OTP');
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.secret'),
      expiresIn: this.config.getOrThrow<StringValue>('jwt.expiresIn'),
    });
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      businessName: user.businessName,
      businessType: user.businessType,
      gstNumber: user.gstNumber,
      isOnboardingCompleted: user.isOnboardingCompleted,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async sendOtp(rawPhone: string): Promise<{ expiresInSeconds: number }> {
    const phone = this.normalizePhone(rawPhone);
    return this.issueOtp(phone);
  }

  async verifyOtp(
    rawPhone: string,
    code: string,
  ): Promise<{
    accessToken: string;
    user: AuthUser;
  }> {
    const phone = this.normalizePhone(rawPhone);
    await this.consumeOtp(phone, code);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          businessName: 'My business',
          role: UserRole.BUYER,
        },
      });
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, user: this.toAuthUser(user) };
  }

  async loginAdmin(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (
      !user ||
      user.role !== UserRole.ADMIN ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, user: this.toAuthUser(user) };
  }

  // ------- Google sign-in flow -------

  private signRegistrationToken(profile: GoogleProfile): string {
    const payload: RegistrationTokenPayload = {
      purpose: REGISTRATION_TOKEN_PURPOSE,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
    const secret = this.config.getOrThrow<string>('jwt.secret');
    const ttl = this.config.getOrThrow<StringValue>('jwt.expiresIn');
    return this.jwt.sign(payload, { secret, expiresIn: ttl });
  }

  private verifyRegistrationToken(token: string): RegistrationTokenPayload {
    const secret = this.config.getOrThrow<string>('jwt.secret');
    let decoded: RegistrationTokenPayload;
    try {
      decoded = this.jwt.verify<RegistrationTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired registration token');
    }
    if (decoded?.purpose !== REGISTRATION_TOKEN_PURPOSE) {
      throw new UnauthorizedException('Invalid registration token');
    }
    return decoded;
  }

  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    const profile = await this.googleVerifier.verifyIdToken(idToken);

    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (existingByGoogleId) {
      const accessToken = await this.signAccessToken(existingByGoogleId);
      return {
        message: 'authenticated',
        accessToken,
        user: this.toAuthUser(existingByGoogleId),
      };
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingByEmail) {
      if (
        existingByEmail.googleId &&
        existingByEmail.googleId !== profile.googleId
      ) {
        throw new ConflictException(
          'This email is already linked to a different Google account',
        );
      }
      const linked = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: profile.googleId,
          name: existingByEmail.name ?? profile.name ?? null,
        },
      });
      const accessToken = await this.signAccessToken(linked);
      return {
        message: 'authenticated',
        accessToken,
        user: this.toAuthUser(linked),
      };
    }

    const registrationToken = this.signRegistrationToken(profile);
    return {
      message: 'needs_phone',
      registrationToken,
      profile: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
    };
  }

  async sendOtpForGoogleRegistration(
    registrationToken: string,
    rawPhone: string,
  ): Promise<{ expiresInSeconds: number }> {
    this.verifyRegistrationToken(registrationToken);
    const phone = this.normalizePhone(rawPhone);
    return this.issueOtp(phone);
  }

  async completeGoogleRegistration(
    registrationToken: string,
    rawPhone: string,
    code: string,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const profile = this.verifyRegistrationToken(registrationToken);
    const phone = this.normalizePhone(rawPhone);

    await this.consumeOtp(phone, code);

    const conflictByGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (conflictByGoogle && conflictByGoogle.phone !== phone) {
      throw new ConflictException(
        'This Google account is already linked to a different user',
      );
    }
    const conflictByEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (conflictByEmail && conflictByEmail.phone !== phone) {
      throw new ConflictException(
        'This email is already linked to a different user',
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { phone } });

    let user: User;
    if (existing) {
      if (existing.googleId && existing.googleId !== profile.googleId) {
        throw new ConflictException(
          'This phone is already linked to a different Google account',
        );
      }
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: profile.googleId,
          email: existing.email ?? profile.email,
          name: existing.name ?? profile.name ?? null,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          phone,
          email: profile.email,
          name: profile.name ?? null,
          googleId: profile.googleId,
          businessName: profile.name ?? 'My business',
          role: UserRole.BUYER,
        },
      });
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, user: this.toAuthUser(user) };
  }
}
