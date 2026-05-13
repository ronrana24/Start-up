import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type RequestWithUser = Request & {
  user?: User;
};

const ONBOARDING_ALLOWED_PATHS = ['/users/me', '/users/me/addresses'] as const;

function normalizePath(request: RequestWithUser): string {
  const path = request.path || request.originalUrl?.split('?')[0] || '';
  return path.replace(/^\/api(?=\/|$)/, '');
}

function isOnboardingPath(path: string): boolean {
  return ONBOARDING_ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  );
}

@Injectable()
export class OnboardingGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user || user.role === UserRole.ADMIN || user.isOnboardingCompleted) {
      return true;
    }

    if (isOnboardingPath(normalizePath(request))) {
      return true;
    }

    throw new ForbiddenException(
      'Please complete onboarding before continuing.',
    );
  }
}
