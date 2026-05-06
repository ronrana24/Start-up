import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DevSmsService } from './sms/dev-sms.service';
import { ProductionSmsService } from './sms/production-sms.service';
import { SMS_SERVICE } from './sms/sms.service';
import { SmsRouterService } from './sms/sms-router.service';
import { GoogleVerifierService } from './google/google-verifier.service';
import { StringValue } from 'ms';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.getOrThrow<StringValue>('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleVerifierService,
    DevSmsService,
    ProductionSmsService,
    { provide: SMS_SERVICE, useClass: SmsRouterService },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
