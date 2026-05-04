import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class GoogleVerifierService {
  private readonly logger = new Logger(GoogleVerifierService.name);
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('google.clientId') ?? '';
    this.client = new OAuth2Client(this.clientId || undefined);
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    if (!this.clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `Google ID token verification failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    if (!payload.email) {
      throw new BadRequestException('Google account has no email');
    }
    if (!payload.email_verified) {
      throw new BadRequestException('Google account email is not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: true,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
