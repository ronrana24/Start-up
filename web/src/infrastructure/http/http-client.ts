import { DomainError, type DomainErrorCode } from "@domain/errors";

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function buildApiUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function messageFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => messageFromUnknown(item))
      .filter((item): item is string => Boolean(item))
      .join("; ");
    return joined || null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message = messageFromUnknown(record.message);
    const details = messageFromUnknown(record.details);
    if (details && isGenericValidationMessage(message)) {
      return details;
    }
    return (
      message ??
      messageFromUnknown(record.error) ??
      details ??
      messageFromUnknown(record.data)
    );
  }
  return null;
}

function isGenericValidationMessage(message: string | null): boolean {
  return (
    message === "Please check the highlighted fields and try again." ||
    message === "Please check your request and try again."
  );
}

export async function readApiErrorMessage(res: Response): Promise<string> {
  const parsed = await readApiError(res);
  return parsed.message;
}

/**
 * Pull both a user-facing message and a structured error code out of the
 * response body, falling back to status-derived defaults. Lets callers
 * branch on `code === "CONFLICT"` (e.g. checkout stock contention) without
 * having to re-parse the body themselves.
 */
export async function readApiError(
  res: Response,
): Promise<{ message: string; code: DomainErrorCode }> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* body is empty or not JSON */
  }
  const message =
    messageFromUnknown(body) ?? res.statusText ?? "Request failed";
  const bodyCode = extractDomainCode(body);
  const code = bodyCode ?? errorCodeFromStatus(res.status);
  return { message, code };
}

function extractDomainCode(body: unknown): DomainErrorCode | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { code?: unknown }).code;
  if (typeof raw !== "string") return null;
  return mapApiCodeToDomain(raw);
}

function mapApiCodeToDomain(code: string): DomainErrorCode | null {
  switch (code) {
    case "CONFLICT":
    case "DATABASE_CONSTRAINT":
      return "CONFLICT";
    case "AUTHENTICATION_ERROR":
      return "UNAUTHORIZED";
    case "AUTHORIZATION_ERROR":
    case "ONBOARDING_REQUIRED":
      return "FORBIDDEN";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "VALIDATION_ERROR":
    case "BUSINESS_RULE_FAILED":
      return "INVALID_INPUT";
    default:
      return null;
  }
}

function errorCodeFromStatus(status: number): DomainErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  return "INVALID_INPUT";
}

function networkFailure(): DomainError {
  return new DomainError(
    "NETWORK",
    "No internet connection. Check your network and try again.",
  );
}

export async function apiJsonPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  const url = buildApiUrl(baseUrl, path);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw networkFailure();
  }
  if (!res.ok) {
    const { code, message } = await readApiError(res);
    throw new DomainError(code, message);
  }
  return (await res.json()) as T;
}

export type ApiJsonMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function apiJsonAuthorized<T>(
  baseUrl: string,
  path: string,
  options: {
    method: ApiJsonMethod;
    body?: unknown;
  },
): Promise<T> {
  const url = buildApiUrl(baseUrl, path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // no authorization header needed for authorized requests
  // because the request is authenticated via cookies
  // access_token is stored in the cookie
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method,
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });
  } catch {
    throw networkFailure();
  }
  if (!res.ok) {
    const { code, message } = await readApiError(res);
    throw new DomainError(code, message);
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
