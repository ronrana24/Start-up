import { DomainError } from "@domain/errors";

export function domainErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
