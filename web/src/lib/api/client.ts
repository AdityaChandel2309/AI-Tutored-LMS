// ─── Typed fetch wrapper ───────────────────
// Centralized API client with auth handling. All API calls go through this.
// Prevents duplicated fetch logic across components.

import { getApiUrl } from "@/lib/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Normalizes a backend `message` field which may be a string or, for
// validation errors, an array of strings.
function normalizeMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((v) => typeof v === "string").join(", ") || null;
  }
  return null;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = getApiUrl(path);
  const res = await fetch(url, {
    credentials: "include",
    ...init,
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => null);
    // The backend wraps errors as `{ error: { message, code, ... } }`
    // (ResponseEnvelope/ApiExceptionFilter). Older/raw responses may put the
    // message at the top level, so we fall back to that too.
    const envelope = body?.error ?? body;
    const message =
      normalizeMessage(envelope?.message) ??
      normalizeMessage(body?.message) ??
      `HTTP ${res.status}`;
    throw new ApiError(
      message,
      res.status,
      envelope?.code ?? body?.code,
    );
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string) {
  return apiFetch<T>(path);
}

export function apiPost<T = unknown>(
  path: string,
  data?: unknown,
) {
  return apiFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data ?? {}),
  });
}

export function apiPatch<T = unknown>(
  path: string,
  data: unknown,
) {
  return apiFetch<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function apiDelete<T = unknown>(
  path: string,
) {
  return apiFetch<T>(path, { method: "DELETE" });
}
