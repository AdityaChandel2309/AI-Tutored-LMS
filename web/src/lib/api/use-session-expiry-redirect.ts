"use client";

// ─── Session-expiry redirect guard ─────────
// Centralizes the auth-failure redirect so every redesigned page behaves
// identically regardless of which presentation state (loading/error/empty)
// is showing. Preserves the prior semantics:
//   - 401 + code === "session_expired" → /?reason=session-expired
//   - any other 401                    → /
//   - non-401 / no error               → no redirect

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";

// Pure redirect-decision function — extracted from the hook so the
// state-independent decision logic can be exercised by property tests
// without a router. Returns the redirect target, or `null` when no
// redirect should occur.
//
//   - 401 + code === "session_expired" → "/?reason=session-expired"
//   - any other 401                    → "/"
//   - non-401 / no error               → null (no redirect)
export function sessionExpiryRedirectTarget(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 401) {
    return error.code === "session_expired"
      ? "/?reason=session-expired"
      : "/";
  }
  return null;
}

export function useSessionExpiryRedirect(error: unknown): void {
  const router = useRouter();

  useEffect(() => {
    const target = sessionExpiryRedirectTarget(error);
    if (target !== null) {
      router.replace(target);
    }
  }, [error, router]);
}
