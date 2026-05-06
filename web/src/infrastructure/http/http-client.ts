import { DomainError } from "@domain/errors";

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function buildApiUrl(baseUrl: string, path: string): string {
  const base = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      const m = (data as { message: unknown }).message;
      if (typeof m === "string") return m;
      if (Array.isArray(m)) return m.filter((x) => typeof x === "string").join(", ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function apiJsonPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<T> {
  const url = buildApiUrl(baseUrl, path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new DomainError(
      res.status === 401 ? "UNAUTHORIZED" : "INVALID_INPUT",
      message,
    );
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
  const res = await fetch(url, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new DomainError(
      res.status === 401 ? "UNAUTHORIZED" : "INVALID_INPUT",
      message,
    );
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
