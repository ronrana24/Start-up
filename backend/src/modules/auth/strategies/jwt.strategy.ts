import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  phone: string;
  /** Primary role (backward-compat). The strategy always re-reads from DB. */
  role: string;
  /** All assigned roles. Present in tokens issued after multi-role migration. */
  roles?: string[];
};

type RequestWithCookies = {
  cookies?: Record<string, string | undefined>;
};

function cookieExtractor(cookieName: string) {
  return (request: RequestWithCookies | undefined): string | null =>
    request?.cookies?.[cookieName] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor(config.getOrThrow<string>('auth.cookie.name')),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
