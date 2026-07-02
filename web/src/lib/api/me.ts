// ─── Shared current-user hook ──────────────
// Centralized TanStack Query hook for the authenticated user (`GET /api/me`).
// All components share this — no duplicated fetch/session logic.
//
// NOTE: `GET /api/me` returns the UNWRAPPED user object (via
// `relayBackendDataResponse`), so consumers read `data.roles` directly
// (NOT `data.data.roles`). Reading the wrong shape was the portal-layout
// bug where role-gated sections never rendered.

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

// Shape of the authenticated user as returned by `GET /api/me`.
export type DashboardUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  roles: string[];
  tenantId: string;
  isActive?: boolean;
};

// ── Query Keys ──────────────────────────────

export const meKeys = {
  me: ["me"] as const,
};

// ── Queries ─────────────────────────────────

export function useMe() {
  return useQuery<DashboardUser>({
    queryKey: meKeys.me,
    // `GET /api/me` (credentials included via apiGet). The response is the
    // UNWRAPPED user object, so consumers read `data.roles` directly.
    queryFn: () => apiGet<DashboardUser>("/me"),
  });
}
