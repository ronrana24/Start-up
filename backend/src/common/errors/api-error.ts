import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ValidationError } from 'class-validator';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'ONBOARDING_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_FAILED'
  | 'RATE_LIMITED'
  | 'DATABASE_CONSTRAINT'
  | 'INTERNAL_SERVER_ERROR';

export type ApiValidationDetail = {
  field: string;
  message: string;
  code?: string;
};

export type ResolvedApiError = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: ApiValidationDetail[];
};

type ConstraintEntry = [constraint: string, message: string];

const CONSTRAINT_PRIORITY = [
  'whitelistValidation',
  'isDefined',
  'isNotEmpty',
  'matches',
  'isEmail',
  'isEnum',
  'isIn',
  'isUrl',
  'minLength',
  'maxLength',
  'length',
  'min',
  'max',
  'isInt',
  'isNumber',
  'isString',
  'isBoolean',
  'isArray',
  'nestedValidation',
];

const TECHNICAL_MESSAGE_PATTERNS = [
  /\/\^/,
  /\\[dws]/i,
  /\(\?=/,
  /regular expression/i,
  /duplicate key/i,
  /violates .*constraint/i,
  /\b(prisma|sql|postgres|database|query|stack trace)\b/i,
  /\b(select|insert|update|delete)\b.+\b(from|into|where)\b/i,
  /\bat .+:\d+:\d+/i,
];

export function validationDetailsFromErrors(
  errors: ValidationError[],
): ApiValidationDetail[] {
  const details: ApiValidationDetail[] = [];
  const seen = new Set<string>();

  const visit = (error: ValidationError, parents: string[]) => {
    const field = [...parents, error.property].filter(Boolean).join('.');
    const constraint = firstConstraint(error.constraints);
    if (constraint) {
      const detail = {
        field,
        message: readableConstraintMessage(field, constraint),
        code: constraint[0],
      };
      const key = `${detail.field}:${detail.message}`;
      if (!seen.has(key)) {
        details.push(detail);
        seen.add(key);
      }
    }

    for (const child of error.children ?? []) {
      visit(child, field ? [...parents, error.property] : parents);
    }
  };

  for (const error of errors) {
    visit(error, []);
  }

  return details;
}

export function codeFromHttpStatus(
  status: number,
  message?: string,
): ApiErrorCode {
  if (
    status === HttpStatus.BAD_REQUEST ||
    status === HttpStatus.UNPROCESSABLE_ENTITY
  ) {
    return 'VALIDATION_ERROR';
  }
  if (status === HttpStatus.UNAUTHORIZED) return 'AUTHENTICATION_ERROR';
  if (status === HttpStatus.FORBIDDEN) {
    return message?.toLowerCase().includes('onboarding')
      ? 'ONBOARDING_REQUIRED'
      : 'AUTHORIZATION_ERROR';
  }
  if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
  if (status === HttpStatus.CONFLICT) return 'CONFLICT';
  if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL_SERVER_ERROR';
  return 'BUSINESS_RULE_FAILED';
}

export function defaultMessageForStatus(status: number): string {
  if (
    status === HttpStatus.BAD_REQUEST ||
    status === HttpStatus.UNPROCESSABLE_ENTITY
  ) {
    return 'Please check your request and try again.';
  }
  if (status === HttpStatus.UNAUTHORIZED) {
    return 'Your session has expired. Please log in again.';
  }
  if (status === HttpStatus.FORBIDDEN) {
    return 'You do not have permission to perform this action.';
  }
  if (status === HttpStatus.NOT_FOUND) {
    return 'The requested resource was not found.';
  }
  if (status === HttpStatus.CONFLICT) {
    return 'This request conflicts with existing data.';
  }
  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function sanitizePublicMessage(
  message: unknown,
  fallback: string,
): string {
  if (typeof message !== 'string') return fallback;
  const trimmed = message.replace(/^Error:\s*/i, '').trim();
  if (!trimmed) return fallback;
  if (
    /^(Unauthorized|UnauthorizedException|Forbidden|Forbidden resource|ForbiddenException|Bad Request|BadRequestException|Internal server error|InternalServerErrorException)$/i.test(
      trimmed,
    )
  ) {
    return fallback;
  }
  if (TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }
  return trimmed;
}

export function resolvePrismaError(
  exception: unknown,
): ResolvedApiError | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      const detail = uniqueConstraintDetail(exception.meta?.target);
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: detail.message,
        details: detail.field
          ? [{ field: detail.field, message: detail.message, code: 'unique' }]
          : undefined,
      };
    }

    if (exception.code === 'P2003') {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'DATABASE_CONSTRAINT',
        message: 'The selected record is invalid or no longer available.',
      };
    }

    if (exception.code === 'P2025' || exception.code === 'P2001') {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The requested record was not found.',
      };
    }

    if (exception.code === 'P2000') {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'One of the fields is too long.',
      };
    }

    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'DATABASE_CONSTRAINT',
      message: 'The request could not be completed with the provided data.',
    };
  }

  if (
    exception instanceof Prisma.PrismaClientValidationError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_ERROR',
      message: 'The request contains invalid data.',
    };
  }

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Service is temporarily unavailable. Please try again.',
    };
  }

  return null;
}

function firstConstraint(
  constraints?: Record<string, string>,
): ConstraintEntry | null {
  if (!constraints) return null;
  const entries = Object.entries(constraints);
  entries.sort(
    (a, b) => priorityForConstraint(a[0]) - priorityForConstraint(b[0]),
  );
  return entries[0] ?? null;
}

function priorityForConstraint(name: string): number {
  const index = CONSTRAINT_PRIORITY.indexOf(name);
  return index === -1 ? CONSTRAINT_PRIORITY.length : index;
}

function readableConstraintMessage(
  fieldPath: string,
  [constraint, rawMessage]: ConstraintEntry,
): string {
  const field = fieldPath || 'value';
  const label = fieldLabel(field);
  const normalizedField = field.toLowerCase();
  const raw = rawMessage ?? '';

  if (constraint === 'whitelistValidation') {
    return `${label} is not allowed.`;
  }
  if (constraint === 'matches') {
    if (normalizedField.includes('phone')) {
      return 'Enter a valid Indian mobile number.';
    }
    if (normalizedField.includes('otp') || normalizedField.endsWith('code')) {
      return 'Enter the 6-digit OTP.';
    }
    if (normalizedField.includes('gst')) {
      return 'Enter a valid 15-character GST number.';
    }
    if (normalizedField.includes('pincode')) {
      return 'Enter a valid PIN code.';
    }
    return `${label} format is invalid.`;
  }
  if (constraint === 'isDefined' || constraint === 'isNotEmpty') {
    return `${label} is required.`;
  }
  if (constraint === 'isString') {
    return `${label} must be text.`;
  }
  if (constraint === 'isBoolean') {
    return `${label} must be true or false.`;
  }
  if (constraint === 'isArray') {
    return `${label} must be a list.`;
  }
  if (constraint === 'isInt') {
    return `${label} must be a whole number.`;
  }
  if (constraint === 'isNumber') {
    return `${label} must be a number.`;
  }
  if (constraint === 'isEnum' || constraint === 'isIn') {
    return `${label} contains an unsupported value.`;
  }
  if (constraint === 'isUrl') {
    return `${label} must be a valid URL.`;
  }
  if (constraint === 'minLength') {
    return `${label} must be at least ${extractNumber(raw) ?? 'the required number of'} characters.`;
  }
  if (constraint === 'maxLength') {
    return `${label} must be at most ${extractNumber(raw) ?? 'the allowed number of'} characters.`;
  }
  if (constraint === 'length') {
    const numbers = extractNumbers(raw);
    if (numbers.length === 1) {
      return `${label} must be ${numbers[0]} characters.`;
    }
    if (numbers.length >= 2) {
      return `${label} must be between ${numbers[0]} and ${numbers[1]} characters.`;
    }
    return `${label} length is invalid.`;
  }
  if (constraint === 'min') {
    return `${label} must be at least ${extractNumber(raw) ?? 'the minimum allowed value'}.`;
  }
  if (constraint === 'max') {
    return `${label} must be at most ${extractNumber(raw) ?? 'the maximum allowed value'}.`;
  }
  if (constraint === 'nestedValidation') {
    return `${label} contains invalid details.`;
  }

  return `${label} is invalid.`;
}

function fieldLabel(fieldPath: string): string {
  const parts = fieldPath
    .split('.')
    .filter(Boolean)
    .map((part) =>
      /^\d+$/.test(part)
        ? `item ${Number(part) + 1}`
        : part
            .replace(/Id$/, ' ID')
            .replace(/Iso$/, ' ISO')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/_/g, ' ')
            .toLowerCase(),
    );
  const label = parts.join(' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function extractNumber(message: string): string | null {
  return extractNumbers(message)[0] ?? null;
}

function extractNumbers(message: string): string[] {
  return [...message.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => match[0]);
}

function uniqueConstraintDetail(target: unknown): {
  field?: string;
  message: string;
} {
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === 'string'
      ? [target]
      : [];
  const normalized = fields.map((field) => field.toLowerCase());

  if (normalized.includes('email')) {
    return {
      field: fields[normalized.indexOf('email')] ?? 'email',
      message: 'An account with this email already exists.',
    };
  }
  if (normalized.includes('phone')) {
    return {
      field: fields[normalized.indexOf('phone')] ?? 'phone',
      message: 'An account with this mobile number already exists.',
    };
  }
  if (normalized.includes('googleid')) {
    return {
      field: fields[normalized.indexOf('googleid')] ?? 'googleId',
      message: 'This Google account is already linked to another user.',
    };
  }
  if (normalized.includes('sku')) {
    return {
      field: fields[normalized.indexOf('sku')] ?? 'sku',
      message: 'A product with this SKU already exists.',
    };
  }

  return { field: fields[0], message: 'This record already exists.' };
}
