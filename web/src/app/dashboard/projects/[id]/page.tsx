"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProject, updateProjectStatus, createMilestone, updateMilestone } from "@/lib/api/projects";
import { StatusBadge } from "@/components/project/status-badge";
import type { Project } from "@/lib/types/project";

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

  if (loadError) return <div className="p-6 text-red-600">{loadError}</div>;
  if (!project) return <div className="p-6">Loading...</div>;

  const nextStatuses: Record<string, string[]> = {
    planning: ["active", "cancelled"],
    active: ["on_hold", "completed", "cancelled"],
    on_hold: ["active", "cancelled"],
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <StatusBadge status={project.status} />
      </div>

      {project.description && <p className="text-gray-600">{project.description}</p>}

      <div className="flex gap-4 text-sm text-gray-500">
        <span>Owner: {project.owner.firstName || project.owner.email}</span>
        {project.department && <span>Department: {project.department.name}</span>}
        {project.startDate && <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>}
        {project.targetEndDate && <span>Target: {new Date(project.targetEndDate).toLocaleDateString()}</span>}
      </div>

      {nextStatuses[project.status] && (
        <div className="flex gap-2">
          {nextStatuses[project.status].map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)} className="px-3 py-1 border rounded text-sm hover:bg-gray-50">
              → {s.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {/* Milestones */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Milestones</h2>
        <div className="space-y-2">
          {project.milestones?.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={m.status === "completed" ? "line-through text-gray-400" : ""}>{m.title}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="flex items-center gap-2">
                {m.dueDate && <span className="text-xs text-gray-400">{new Date(m.dueDate).toLocaleDateString()}</span>}
                {m.status !== "completed" && (
                  <button onClick={() => handleMilestoneStatus(m.id, "completed")} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">✓ Complete</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddMilestone} className="mt-3 flex gap-2">
          <input placeholder="Milestone title" value={newMilestone.title} onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })} className="border rounded px-2 py-1 text-sm flex-1" required />
          <input type="date" value={newMilestone.dueDate} onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })} className="border rounded px-2 py-1 text-sm" />
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Add</button>
        </form>
      </section>

      {/* Members */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Members</h2>
        <div className="space-y-2">
          {project.members?.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
              <span>{m.user.firstName || m.user.email}</span>
              <span className="text-xs text-gray-500">{m.role}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
