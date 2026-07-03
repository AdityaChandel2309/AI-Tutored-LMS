"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { getProject, updateProjectStatus, createMilestone, updateMilestone } from "@/lib/api/projects";
import { StatusBadge } from "@/components/project/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types/project";

const KANBAN_COLUMNS = [
  { id: "pending", title: "To Do", icon: Circle, tone: "text-[var(--color-muted-foreground)]" },
  { id: "in_progress", title: "In Progress", icon: Loader2, tone: "text-[var(--color-warning)]" },
  { id: "completed", title: "Completed", icon: CheckCircle2, tone: "text-[var(--color-success)]" },
] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [newMilestone, setNewMilestone] = useState({ title: "", dueDate: "" });

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getProject(id);
      setProject(res.data as unknown as Project);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This page fetches route-scoped data after the dynamic id is available.
      void load();
    }
  }, [id, load]);

  async function handleStatusChange(status: string) {
    await updateProjectStatus(id, status);
    void load();
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    const order = (project?.milestones?.length ?? 0) + 1;
    await createMilestone(id, { title: newMilestone.title, dueDate: newMilestone.dueDate || undefined, order });
    setNewMilestone({ title: "", dueDate: "" });
    void load();
  }

  async function handleMilestoneStatus(milestoneId: string, status: string) {
    await updateMilestone(id, milestoneId, { status });
    void load();
  }

  if (loadError) return <div className="p-6 text-[var(--color-danger)]">{loadError}</div>;
  if (!project) return <div className="p-6">Loading...</div>;

  const nextStatuses: Record<string, string[]> = {
    planning: ["active", "cancelled"],
    active: ["on_hold", "completed", "cancelled"],
    on_hold: ["active", "cancelled"],
  };

  const milestones = project.milestones ?? [];
  const totalMs = milestones.length;
  const completedMs = milestones.filter((m) => m.status === "completed").length;
  const progressPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
              {project.description && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {project.description}
                </p>
              )}
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-muted-foreground)]">
            <span>Owner: {project.owner.firstName || project.owner.email}</span>
            {project.department && <span>Department: {project.department.name}</span>}
            {project.startDate && <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>}
            {project.targetEndDate && <span>Target: {new Date(project.targetEndDate).toLocaleDateString()}</span>}
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--color-muted-foreground)]">
              <span>Milestone progress</span>
              <span>{completedMs}/{totalMs} complete ({progressPct}%)</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {nextStatuses[project.status] && (
            <div className="mt-4 flex flex-wrap gap-2">
              {nextStatuses[project.status].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange(s)}
                >
                  → {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          )}
        </Card>

        {/* Milestones Kanban */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Milestones</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {KANBAN_COLUMNS.map((col) => {
              const items = milestones.filter((m) => m.status === col.id);
              const Icon = col.icon;
              return (
                <div
                  key={col.id}
                  className="flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card-muted)] p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Icon className={`h-4 w-4 ${col.tone}`} aria-hidden />
                      {col.title}
                    </div>
                    <span className="rounded-full bg-[var(--color-card)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                      {items.length}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {items.length === 0 && (
                      <p className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-center text-xs text-[var(--color-muted-foreground)]">
                        No milestones
                      </p>
                    )}
                    {items.map((m) => {
                      const overdue =
                        m.status !== "completed" &&
                        m.dueDate &&
                        new Date(m.dueDate).getTime() < Date.now();
                      return (
                        <div
                          key={m.id}
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-soft)]"
                        >
                          <p className={`text-sm font-medium ${m.status === "completed" ? "text-[var(--color-muted-foreground)] line-through" : "text-[var(--color-foreground)]"}`}>
                            {m.title}
                          </p>
                          {m.dueDate && (
                            <p className={`mt-1 text-xs ${overdue ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-muted-foreground)]"}`}>
                              Due {new Date(m.dueDate).toLocaleDateString()}
                              {overdue ? " (overdue)" : ""}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {KANBAN_COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleMilestoneStatus(m.id, c.id)}
                                className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                              >
                                → {c.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="p-4">
            <form onSubmit={handleAddMilestone} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  New milestone
                </label>
                <Input
                  placeholder="Milestone title"
                  value={newMilestone.title}
                  onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                  Due date
                </label>
                <Input
                  type="date"
                  value={newMilestone.dueDate}
                  onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
                />
              </div>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" aria-hidden />
                Add milestone
              </Button>
            </form>
          </Card>
        </section>

        {/* Members */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Members</h2>
          <Card className="divide-y divide-[var(--color-border)] p-0">
            {(project.members ?? []).length === 0 && (
              <p className="p-4 text-sm text-[var(--color-muted-foreground)]">No members yet.</p>
            )}
            {project.members?.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">{m.user.firstName || m.user.email}</span>
                <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {m.role}
                </span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </main>
  );
}
