import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ApiErrorCode,
  ApiValidationDetail,
  codeFromHttpStatus,
  defaultMessageForStatus,
  resolvePrismaError,
  sanitizePublicMessage,
} from '../errors/api-error';

type HttpExceptionResponse = {
  code?: ApiErrorCode | string;
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

type ErrorPayload = {
  success: false;
  code: ApiErrorCode;
  message: string;
  details?: ApiValidationDetail[];
  path: string;
  timestamp: string;
  requestId?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const resolved =
      resolvePrismaError(exception) ?? this.resolveHttpException(exception);
    const status = Number(resolved.status);
    const requestId = request.headers['x-request-id'];

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logTechnicalError(exception, request);
    }

    const payload: ErrorPayload = {
      success: false,
      code: resolved.code,
      message: resolved.message,
      ...(resolved.details?.length ? { details: resolved.details } : {}),
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
      ...(typeof requestId === 'string' ? { requestId } : {}),
    };

    response.status(status).json(payload);
  }

  private resolveHttpException(exception: unknown): {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: ApiValidationDetail[];
  } {
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: defaultMessageForStatus(HttpStatus.INTERNAL_SERVER_ERROR),
      };
    }

    const status = exception.getStatus();
    const fallback = defaultMessageForStatus(status);
    const body = exception.getResponse();
    const details = this.extractValidationDetails(body);
    const candidate = this.extractMessage(body) ?? exception.message;
    const message =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? fallback
        : details.length > 0
          ? validationSummary(details)
          : sanitizePublicMessage(candidate, fallback);
    const code = this.extractCode(body) ?? codeFromHttpStatus(status, message);

    return {
      status,
      code,
      message,
      ...(details.length ? { details } : {}),
    };
  }

  private extractMessage(body: unknown): unknown {
    if (typeof body === 'string') return body;
    if (!body || typeof body !== 'object') return null;

    const response = body as HttpExceptionResponse;
    if (typeof response.message === 'string') {
      return response.message;
    }
    if (Array.isArray(response.message)) {
      const messages = response.message.filter(
        (item): item is string => typeof item === 'string',
      );
      return messages.length ? messages.join('; ') : null;
    }
    if (typeof response.error === 'string') {
      return response.error;
    }
    return null;
  }

  private extractCode(body: unknown): ApiErrorCode | null {
    if (!body || typeof body !== 'object') return null;
    const code = (body as HttpExceptionResponse).code;
    return typeof code === 'string' && isApiErrorCode(code) ? code : null;
  }

  private extractValidationDetails(body: unknown): ApiValidationDetail[] {
    if (!body || typeof body !== 'object') return [];
    const details = (body as HttpExceptionResponse).details;
    if (!Array.isArray(details)) return [];

    return details.filter(isValidationDetail).map((detail) => ({
      field: detail.field,
      message: sanitizePublicMessage(detail.message, 'This field is invalid.'),
      ...(detail.code ? { code: detail.code } : {}),
    }));
  }

  private logTechnicalError(exception: unknown, request: Request): void {
    const requestSummary = `${request.method} ${request.originalUrl || request.url}`;
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled API error during ${requestSummary}: ${exception.message}`,
        exception.stack,
      );
      return;
    }
    this.logger.error(
      `Unhandled API error during ${requestSummary}`,
      JSON.stringify(exception),
    );
  }
}

function isValidationDetail(value: unknown): value is ApiValidationDetail {
  if (!value || typeof value !== 'object') return false;
  const detail = value as Partial<ApiValidationDetail>;
  return typeof detail.field === 'string' && typeof detail.message === 'string';
}

function isApiErrorCode(value: string): value is ApiErrorCode {
  return [
    'VALIDATION_ERROR',
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'ONBOARDING_REQUIRED',
    'NOT_FOUND',
    'CONFLICT',
    'BUSINESS_RULE_FAILED',
    'RATE_LIMITED',
    'DATABASE_CONSTRAINT',
    'INTERNAL_SERVER_ERROR',
  ].includes(value);
}

function validationSummary(details: ApiValidationDetail[]): string {
  const messages = [
    ...new Set(
      details
        .map((detail) => detail.message.trim())
        .filter((message) => message.length > 0),
    ),
  ];

  if (messages.length === 0) {
    return 'Please check your request and try again.';
  }
  if (messages.length <= 2) {
    return messages.join(' ');
  }
  return `${messages[0]} Fix ${messages.length - 1} other fields and try again.`;
}
