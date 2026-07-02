"use client";

import { useState } from "react";
import { useAuditLogs, type AuditFilters } from "@/lib/api/audit";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonTable } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ limit: PAGE_SIZE, offset: 0 });
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const auditLogs = useAuditLogs(filters);
  const data = auditLogs.data;

  function applyFilters() {
    setFilters((prev) => ({
      ...prev,
      action: actionFilter || undefined,
      entityType: entityTypeFilter || undefined,
      offset: 0,
    }));
  }

  function clearFilters() {
    setActionFilter("");
    setEntityTypeFilter("");
    setFilters({ limit: PAGE_SIZE, offset: 0 });
  }

  const offset = filters.offset ?? 0;
  const total = data?.total ?? 0;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden">
          <SectionHeading
            badge={<Badge variant="neutral">Governance</Badge>}
            title="Audit Logs"
            description="View system activity and user actions for compliance and governance."
          />

          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 border-b border-[var(--color-border)]">
            <Input
              placeholder="Filter by action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-48"
            />
            <Input
              placeholder="Filter by entity type..."
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="w-48"
            />
            <Button variant="default" onClick={applyFilters}>Apply</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>

          <AsyncBoundary
            query={auditLogs}
            skeleton={<SkeletonTable rows={8} />}
            errorMessage="We couldn't load the audit logs. Please try again."
          >
            {(result) => {
              // `result` is the AuditLogsResponse object ({ logs, total }), so
              // AsyncBoundary's array/null empty check never fires — guard the
              // empty result explicitly here.
              if (result.logs.length === 0) {
                return (
                  <EmptyState
                    title="No audit logs found"
                    description="No audit logs match your current filters."
                  />
                );
              }

              return (
                <Table>
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-4 py-2 text-left font-medium">Timestamp</th>
                      <th className="px-4 py-2 text-left font-medium">Action</th>
                      <th className="px-4 py-2 text-left font-medium">Entity</th>
                      <th className="px-4 py-2 text-left font-medium">Actor</th>
                      <th className="px-4 py-2 text-left font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.logs.map((log) => (
                      <tr key={log.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-muted)]">
                        <td className="px-4 py-2 text-sm whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="neutral">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {log.entityType && (
                            <span>{log.entityType}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm font-mono">
                          {log.actorId ? log.actorId.slice(0, 8) + "…" : "system"}
                        </td>
                        <td className="px-4 py-2 text-sm text-[var(--color-muted-foreground)]">
                          {log.ipAddress ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              );
            }}
          </AsyncBoundary>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between p-4 border-t border-[var(--color-border)]">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, (f.offset ?? 0) - PAGE_SIZE) }))}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <Button
                variant="outline"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setFilters((f) => ({ ...f, offset: (f.offset ?? 0) + PAGE_SIZE }))}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
