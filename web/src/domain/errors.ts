export type DomainErrorCode =
  | "NOT_FOUND"
  | "INVALID_OTP"
  | "INVALID_INPUT"
  | "UNAUTHORIZED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
