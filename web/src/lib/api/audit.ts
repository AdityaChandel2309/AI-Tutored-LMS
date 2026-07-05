import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

export interface AuditFilters {
  actorId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export function useAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams();
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const qs = params.toString();

  return useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", filters],
    queryFn: () => apiGet(`/audit/logs${qs ? `?${qs}` : ""}`),
  });
}
