"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useProjects } from "@/lib/api/projects";
import { StatusBadge } from "@/components/project/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonCard } from "@/components/ui/skeleton";

const STATUSES = ["", "planning", "active", "on_hold", "completed", "cancelled"];

export default function ProjectsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const projects = useProjects({ status: statusFilter || undefined });

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            title="Projects"
            description="Track project delivery, milestones, and team members."
            actions={
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/projects/new")}
              >
                <Plus className="h-4 w-4" aria-hidden />
                New Project
              </Button>
            }
          />
        </Card>

        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s ? s.replace("_", " ") : "All"}
            </Button>
          ))}
        </div>

        <AsyncBoundary
          query={projects}
          skeleton={
            <div className="grid gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          }
          empty={
            <EmptyState
              title="No projects found"
              description={
                statusFilter
                  ? "No projects match the selected status filter."
                  : "Create your first project to get started."
              }
            />
          }
          errorMessage="We couldn't load your projects. Please try again."
        >
          {(items) => (
            <div className="grid gap-4">
              {items.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-[var(--color-foreground)]">{p.title}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-[var(--color-muted-foreground)]">
                    {p.description || "No description"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-muted-foreground)]">
                    <span>Owner: {p.owner.firstName || p.owner.email}</span>
                    {p.department && <span>Dept: {p.department.name}</span>}
                    <span>{p._count?.milestones ?? 0} milestones</span>
                    <span>{p._count?.members ?? 0} members</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}
