import { DomainError } from "@domain/errors";

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
  try {
    const data: unknown = await res.json();
    const message = messageFromUnknown(data);
    if (message) {
      return message;
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

function errorCodeFromStatus(status: number) {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
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
    const message = await readApiErrorMessage(res);
    throw new DomainError(errorCodeFromStatus(res.status), message);
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
    const message = await readApiErrorMessage(res);
    throw new DomainError(errorCodeFromStatus(res.status), message);
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
