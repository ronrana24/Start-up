import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { raw } from 'express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { validationDetailsFromErrors } from './common/errors/api-error';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import Configuration from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: new Logger(bootstrap.name),
  });
  const config = Configuration();
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });
  app.use('/api/payments/razorpay/webhook', raw({ type: 'application/json' }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields and try again.',
          details: validationDetailsFromErrors(errors),
        }),
    }),
  );
  const port = config.port;
  await app.listen(port);
  console.log(`🚀 Server is running on port ${port}`);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger(bootstrap.name);
  if (error instanceof Error) {
    logger.error(error.message, error.stack);
  } else {
    logger.error('Backend failed to start', String(error));
  }
  process.exit(1);
});
