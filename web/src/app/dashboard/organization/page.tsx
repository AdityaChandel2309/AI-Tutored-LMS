"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { SkeletonCard } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { DepartmentTree } from "@/components/organization/department-tree";
import {
  useCreateDepartment,
  useCreateDesignation,
  useDepartments,
  useDesignations,
} from "@/lib/api/organization";

export default function OrganizationPage() {
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showDesForm, setShowDesForm] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", code: "", parentId: "" });
  const [desForm, setDesForm] = useState({ name: "", level: 0 });

  const departmentsQuery = useDepartments();
  const designationsQuery = useDesignations();
  const createDept = useCreateDepartment();
  const createDes = useCreateDesignation();

  const departments = departmentsQuery.data ?? [];

  async function handleCreateDept(e: React.FormEvent) {
    e.preventDefault();
    await createDept.mutateAsync({
      name: deptForm.name,
      code: deptForm.code,
      parentId: deptForm.parentId || undefined,
    });
    setDeptForm({ name: "", code: "", parentId: "" });
    setShowDeptForm(false);
  }

  async function handleCreateDes(e: React.FormEvent) {
    e.preventDefault();
    await createDes.mutateAsync({ name: desForm.name, level: desForm.level });
    setDesForm({ name: "", level: 0 });
    setShowDesForm(false);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
          <SectionHeading
            badge={<Badge variant="neutral">People</Badge>}
            title="Organization"
            description="Manage departments and designations across your organization."
          />
        </Card>

        {/* Departments */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Departments</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDeptForm(!showDeptForm)}
              aria-expanded={showDeptForm}
            >
              <Plus aria-hidden className="h-4 w-4" />
              Add
            </Button>
          </div>
          {showDeptForm && (
            <form
              onSubmit={handleCreateDept}
              className="flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <Input
                placeholder="Name"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-auto min-w-[160px] flex-1"
                required
              />
              <Input
                placeholder="Code"
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                className="w-auto min-w-[120px]"
                required
              />
              <Select
                value={deptForm.parentId}
                onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })}
                className="w-auto min-w-[160px]"
              >
                <option value="">No parent</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm" disabled={createDept.isPending}>
                {createDept.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          )}
          <AsyncBoundary
            query={departmentsQuery}
            skeleton={<SkeletonCard />}
            errorMessage="Failed to load departments"
            empty={
              <Card className="p-8">
                <EmptyState
                  icon={Building2}
                  title="No departments yet"
                  description="Add a department to start building your org structure."
                />
              </Card>
            }
          >
            {(depts) => <DepartmentTree departments={depts} />}
          </AsyncBoundary>
        </section>

        {/* Designations */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">Designations</h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDesForm(!showDesForm)}
              aria-expanded={showDesForm}
            >
              <Plus aria-hidden className="h-4 w-4" />
              Add
            </Button>
          </div>
          {showDesForm && (
            <form
              onSubmit={handleCreateDes}
              className="flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <Input
                placeholder="Name"
                value={desForm.name}
                onChange={(e) => setDesForm({ ...desForm, name: e.target.value })}
                className="w-auto min-w-[160px] flex-1"
                required
              />
              <Input
                type="number"
                placeholder="Level"
                value={desForm.level}
                onChange={(e) => setDesForm({ ...desForm, level: Number(e.target.value) })}
                className="w-20"
              />
              <Button type="submit" size="sm" disabled={createDes.isPending}>
                {createDes.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          )}
          <AsyncBoundary
            query={designationsQuery}
            skeleton={<SkeletonCard />}
            errorMessage="Failed to load designations"
            empty={
              <Card className="p-8">
                <EmptyState
                  title="No designations yet"
                  description="Add a designation to assign roles and levels."
                />
              </Card>
            }
          >
            {(designations) => (
              <div className="grid gap-2">
                {designations.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
                  >
                    <span className="text-[var(--color-foreground)]">{d.name}</span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      Level {d.level} • {d._count?.employees ?? 0} employees
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AsyncBoundary>
        </section>
      </div>
    </main>
  );
}
