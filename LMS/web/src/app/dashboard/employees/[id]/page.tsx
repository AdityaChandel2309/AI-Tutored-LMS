"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { useEmployee, useReportees } from "@/lib/api/employees";
import type { EmployeeProfile } from "@/lib/types/organization";

function fullName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-sm text-[var(--color-muted-foreground)]">{label}</span>
      <p className="font-medium text-[var(--color-foreground)]">{value}</p>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const employeeQuery = useEmployee(id);
  const reporteesQuery = useReportees(id);
  const reportees = reporteesQuery.data ?? [];

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <AsyncBoundary query={employeeQuery} errorMessage="Failed to load employee">
          {(employee: EmployeeProfile) => (
            <>
              <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
                <SectionHeading
                  badge={<Badge variant="neutral">People</Badge>}
                  title={fullName(employee.user)}
                  description={employee.employeeCode}
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/employees")}
                    >
                      <ArrowLeft aria-hidden className="h-4 w-4" />
                      Directory
                    </Button>
                  }
                />
              </Card>

              <Card>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailRow label="Employee Code" value={employee.employeeCode} />
                  <DetailRow label="Email" value={employee.user.email} />
                  <DetailRow label="Department" value={employee.department?.name ?? "—"} />
                  <DetailRow label="Designation" value={employee.designation?.name ?? "—"} />
                  <DetailRow label="Location" value={employee.location ?? "—"} />
                  <DetailRow label="Phone" value={employee.phone ?? "—"} />
                  <DetailRow
                    label="Reporting Manager"
                    value={
                      employee.reportingManager
                        ? fullName(employee.reportingManager)
                        : "—"
                    }
                  />
                  <DetailRow
                    label="Date of Joining"
                    value={
                      employee.dateOfJoining
                        ? new Date(employee.dateOfJoining).toLocaleDateString()
                        : "—"
                    }
                  />
                </div>
              </Card>

              {reportees.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
                    Direct Reports ({reportees.length})
                  </h2>
                  <div className="grid gap-2">
                    {reportees.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
                      >
                        <span className="text-[var(--color-foreground)]">{fullName(r.user)}</span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {r.designation?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}
