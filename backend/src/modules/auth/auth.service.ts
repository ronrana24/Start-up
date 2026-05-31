import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, Rider, User, UserRole } from '@prisma/client';
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
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
};

export type AuthRider = {
  id: string;
  name: string;
  phone: string;
  status: string;
  isAvailable: boolean;
};

export type RiderGoogleLoginResult =
  | {
      message: 'authenticated';
      accessToken: string;
      user: AuthUser;
      rider: AuthRider;
    }
  | {
      message: 'needs_phone';
      registrationToken: string;
      profile: { email: string; name?: string; picture?: string };
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
      // Primary role kept in the flat field for JWT backward-compat;
      // the strategy always reloads the user row so this is informational only.
      role: user.roles[0] ?? UserRole.BUYER,
      roles: user.roles,
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
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toAuthRider(rider: Rider): AuthRider {
    return {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      status: rider.status,
      isAvailable: rider.isAvailable,
    };
  }

  private async assertRiderUser(user: User): Promise<Rider> {
    if (!user.roles.includes(UserRole.RIDER)) {
      throw new UnauthorizedException(
        'Google account is not registered with other role',
      );
    }
    const rider = await this.prisma.rider.findUnique({
      where: { userId: user.id },
    });
    if (!rider) {
      throw new UnauthorizedException(
        'Rider profile not found for this account',
      );
    }
    return rider;
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
          roles: [UserRole.BUYER],
        },
      });
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, user: this.toAuthUser(user) };
  }

  async verifyRiderOtp(
    rawPhone: string,
    code: string,
  ): Promise<{
    accessToken: string;
    user: AuthUser;
    rider: AuthRider;
  }> {
    const phone = this.normalizePhone(rawPhone);
    await this.consumeOtp(phone, code);

    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { rider: true },
    });
    if (user && !user.roles.includes(UserRole.RIDER)) {
      throw new UnauthorizedException('Phone is not registered as a rider');
    }
    if (!user) {
      throw new UnauthorizedException('Phone is not registered as a rider');
    }
    if (!user.rider) {
      throw new UnauthorizedException('Phone is not registered as a rider');
    }

    const accessToken = await this.signAccessToken(user);
    return {
      accessToken,
      user: this.toAuthUser(user),
      rider: this.toAuthRider(user.rider),
    };
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
      !user.roles.includes(UserRole.ADMIN) ||
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
          roles: [UserRole.BUYER],
        },
      });
    }

    const accessToken = await this.signAccessToken(user);
    return { accessToken, user: this.toAuthUser(user) };
  }

  async loginRiderWithGoogle(idToken: string): Promise<RiderGoogleLoginResult> {
    const profile = await this.googleVerifier.verifyIdToken(idToken);

    // Resolve the account by googleId, falling back to email (same pattern as
    // `loginWithGoogle`). Link the Google id when matched by email so future
    // sign-ins hit the googleId path directly.
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (!user) {
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
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: profile.googleId,
            name: existingByEmail.name ?? profile.name ?? null,
          },
        });
      }
    }

    if (user?.roles.includes(UserRole.RIDER)) {
      const rider = await this.assertRiderUser(user);
      const accessToken = await this.signAccessToken(user);
      return {
        message: 'authenticated',
        accessToken,
        user: this.toAuthUser(user),
        rider: this.toAuthRider(rider),
      };
    }

    // No matching account yet, or the matched user holds only BUYER/ADMIN
    // roles — hand back a registration token so the Android client switches
    // to AuthMode.GOOGLE_PHONE and runs the same rider onboarding flow used
    // for brand-new Google sign-ups.
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

  async sendOtpForRiderGoogleRegistration(
    registrationToken: string,
    rawPhone: string,
  ): Promise<{ expiresInSeconds: number }> {
    this.verifyRegistrationToken(registrationToken);
    const phone = this.normalizePhone(rawPhone);
    const existingRider = await this.prisma.rider.findUnique({
      where: { phone },
    });
    if (existingRider) {
      throw new ConflictException(
        'A rider account already exists for this mobile number',
      );
    }
    return this.issueOtp(phone);
  }

  async completeRiderGoogleRegistration(
    registrationToken: string,
    rawPhone: string,
    code: string,
  ): Promise<{ accessToken: string; user: AuthUser; rider: AuthRider }> {
    const profile = this.verifyRegistrationToken(registrationToken);
    const phone = this.normalizePhone(rawPhone);
    const fallbackName = profile.name?.trim() || 'Rider';

    // Three independent point lookups — run in parallel so the read phase
    // costs one DB round-trip instead of three.
    const [conflictByGoogle, existing] = await Promise.all([
      this.prisma.user.findUnique({
        where: { googleId: profile.googleId },
      }),
      this.prisma.user.findUnique({
        where: { phone },
        include: { rider: true },
      }),
    ]);

    // Validate every conflict BEFORE consuming the OTP, so a failed check
    // never burns the user's only code and forces them to request a new one.
    if (conflictByGoogle && conflictByGoogle.roles.includes(UserRole.RIDER)) {
      throw new ConflictException(
        'This Google account is already linked to a different rider',
      );
    }
    if (existing?.rider) {
      throw new ConflictException(
        'A rider account already exists for this mobile number',
      );
    }
    if (existing?.googleId && existing.googleId !== profile.googleId) {
      throw new ConflictException(
        'This phone is already linked to a different Google account',
      );
    }

    // OTP burns only after every static check passes.
    await this.consumeOtp(phone, code);

    // Both branches return `User & { rider: Rider | null }`. Each is a single
    // top-level Prisma write — Prisma wraps nested writes in an implicit
    // transaction, so we replace the explicit `$transaction` + sequential
    // update/create pair with one round trip per branch.
    const resolvedName = existing?.name ?? profile.name ?? fallbackName;
    try {
      let result;
      if (conflictByGoogle) {
        result = await this.prisma.user.update({
          where: { googleId: profile.googleId, email: profile.email },
          data: {
            googleId: profile.googleId,
            email: profile.email,
            name: resolvedName,
            businessName: fallbackName,
            roles: conflictByGoogle.roles.includes(UserRole.RIDER)
              ? conflictByGoogle.roles
              : [...conflictByGoogle.roles, UserRole.RIDER],
            rider: { create: { name: resolvedName, phone } },
          },
          include: { rider: true },
        });
      } else if (existing) {
        result = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: profile.googleId,
            email: existing.email ?? profile.email,
            name: resolvedName,
            businessName: existing.businessName || fallbackName,
            roles: existing.roles.includes(UserRole.RIDER)
              ? existing.roles
              : [...existing.roles, UserRole.RIDER],
            rider: { create: { name: resolvedName, phone } },
          },
          include: { rider: true },
        });
      } else {
        result = await this.prisma.user.create({
          data: {
            phone,
            email: profile.email,
            name: resolvedName,
            googleId: profile.googleId,
            businessName: fallbackName,
            roles: [UserRole.RIDER],
            isOnboardingCompleted: false,
            rider: { create: { name: fallbackName, phone } },
          },
          include: { rider: true },
        });
      }

      if (!result.rider) {
        // The nested create above always populates rider; this guard exists
        // so TS narrows the response, and so any regression surfaces clearly
        // instead of bubbling up as a null deref.
        throw new InternalServerErrorException(
          'Rider profile failed to create',
        );
      }

      const accessToken = await this.signAccessToken(result);
      return {
        accessToken,
        user: this.toAuthUser(result),
        rider: this.toAuthRider(result.rider),
      };
    } catch (e) {
      // Translate races on the unique constraints (phone / email / googleId /
      // rider.userId) into a clean 409 — without this they'd surface as 500s
      // when another concurrent request beats us to the same record.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'This account was just claimed by another sign-in. Please sign in again.',
        );
      }
      throw e;
    }
  }
}
