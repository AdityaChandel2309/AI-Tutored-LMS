// ─── Typed notification domain hooks ───────
// Centralized TanStack Query hooks for the notification domain.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apiGet,
  apiPost,
  apiPatch,
} from "@/lib/api/client";
import type {
  Notification,
  UnreadCountResponse,
} from "@/lib/types/course";

// ── Query Keys ──────────────────────────────

export const notificationKeys = {
  list: ["notifications"] as const,
  unreadCount: ["notifications-unread-count"] as const,
};

// ── Queries ─────────────────────────────────

export function useNotifications(take = 20) {
  return useQuery<Notification[]>({
    queryKey: [...notificationKeys.list, take],
    queryFn: () =>
      apiGet(`/my/notifications?take=${take}`),
  });
}

export function useUnreadCount() {
  return useQuery<UnreadCountResponse>({
    queryKey: notificationKeys.unreadCount,
    queryFn: () =>
      apiGet("/my/notifications/unread-count"),
    refetchInterval: 60_000, // Poll every 60s
  });
}

// ── Mutations ───────────────────────────────

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch(`/notifications/${notificationId}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: notificationKeys.list,
      });
      qc.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost("/my/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: notificationKeys.list,
      });
      qc.invalidateQueries({
        queryKey: notificationKeys.unreadCount,
      });
    },
  });
}
