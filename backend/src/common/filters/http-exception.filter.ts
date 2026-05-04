import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

type ValidationErrorLike = Pick<ValidationError, 'property' | 'constraints'>;

function collectValidationMessages(errors: ValidationErrorLike[]): string[] {
  const messages: string[] = [];
  for (const err of errors) {
    if (err.constraints) {
      messages.push(
        ...Object.values(err.constraints).map((m) => `${err.property}: ${m}`),
      );
    }
  }
  return messages;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      let errorMessage: string;
      if (typeof res === 'string') {
        errorMessage = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const msg = (res as { message?: string | string[] | ValidationError[] })
          .message;
        if (Array.isArray(msg)) {
          const validationErrors = msg.filter(
            (m): m is ValidationErrorLike =>
              typeof m === 'object' &&
              m !== null &&
              'property' in m &&
              'constraints' in m,
          );
          if (validationErrors.length) {
            errorMessage =
              collectValidationMessages(validationErrors).join('; ');
          } else {
            errorMessage = (msg as string[]).join('; ');
          }
        } else {
          errorMessage = msg ?? exception.message;
        }
      } else {
        errorMessage = exception.message;
      }
      response.status(status).json({ success: false, error: errorMessage });
      return;
    }

    const message =
      exception instanceof Error ? exception.message : 'Internal server error';
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: message,
    });
  }
}
