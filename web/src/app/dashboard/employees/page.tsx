"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonCard } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { EmployeeCard } from "@/components/organization/employee-card";
import { useEmployees } from "@/lib/api/employees";
import { useDepartments } from "@/lib/api/organization";

const PAGE_SIZE = 20;

export default function EmployeesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);

  const departmentsQuery = useDepartments();
  const employeesQuery = useEmployees({
    search: search || undefined,
    departmentId: departmentId || undefined,
    page,
  });

  const departments = departmentsQuery.data ?? [];
  const total = employeesQuery.data?.total ?? 0;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
          <SectionHeading
            badge={<Badge variant="neutral">People</Badge>}
            title="Employee Directory"
            description="Browse your organization's employees and import records in bulk."
            actions={
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/employees/import")}
              >
                <Upload aria-hidden className="h-4 w-4" />
                Import CSV
              </Button>
            }
          />
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="min-w-[200px] flex-1"
          />
          <Select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-auto min-w-[180px]"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-sm text-[var(--color-muted-foreground)]">
          {total} employee{total !== 1 ? "s" : ""} found
        </p>

        {/* List */}
        <AsyncBoundary
          query={employeesQuery}
          skeleton={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          }
          errorMessage="Failed to load employees"
        >
          {(data) =>
            data.items.length === 0 ? (
              <Card className="p-8">
                <EmptyState
                  icon={Users}
                  title="No employees found"
                  description={
                    search || departmentId
                      ? "No employees match your filters."
                      : "Import employees to populate the directory."
                  }
                  action={
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push("/dashboard/employees/import")
                      }
                    >
                      <Upload aria-hidden className="h-4 w-4" />
                      Import CSV
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((emp) => (
                  <EmployeeCard key={emp.id} employee={emp} />
                ))}
              </div>
            )
          }
        </AsyncBoundary>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </Button>
            <span className="px-3 py-1 text-sm text-[var(--color-muted-foreground)]">
              Page {page}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
