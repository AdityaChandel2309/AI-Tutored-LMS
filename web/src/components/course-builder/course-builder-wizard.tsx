"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Layout,
  Globe,
  Check,
  ChevronRight,
  Save,
  ArrowLeft,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedChangesModal } from "@/components/ui/unsaved-changes-modal";
import { apiFetch, apiPatch } from "@/lib/api/client";
import { PlanPhase } from "./phases/plan-phase";
import { CurriculumPhase } from "./phases/curriculum-phase";
import { LandingPhase } from "./phases/landing-phase";
import type {
  Course,
  CourseStatus,
  CourseModule,
  Lesson,
} from "@/lib/types/course";

type Phase = 1 | 2 | 3;

const PHASES: { id: Phase; label: string; icon: React.ReactNode }[] = [
  { id: 1, label: "Plan", icon: <BookOpen className="h-4 w-4" /> },
  { id: 2, label: "Curriculum", icon: <Layout className="h-4 w-4" /> },
  { id: 3, label: "Publish", icon: <Globe className="h-4 w-4" /> },
];

const statusVariant = (
  s: CourseStatus,
): "success" | "warning" | "neutral" => {
  if (s === "published") return "success";
  if (s === "draft" || s === "review") return "warning";
  return "neutral";
};

// ─── Wizard Shell ─────────────────────────────────────────

export function CourseBuilderWizard({ courseId }: { courseId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const [activePhase, setActivePhase] = useState<Phase>(1);
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<Phase | null>(null);

  // Ref-based callback so "Save All" can trigger PlanPhase's save
  const planSaveRef = useRef<(() => void) | null>(null);

  // ── Course query ──
  const {
    data: course,
    isLoading,
    error,
  } = useQuery<Course>({
    queryKey: ["course", courseId],
    queryFn: () => apiFetch(`/courses/${courseId}`),
  });

  // ── Batch save mutation ──
  const saveMut = useMutation({
    mutationFn: async (data: {
      title?: string;
      description?: string;
      categoryId?: string;
    }) => {
      setIsSaving(true);
      setSaveError(null);
      try {
        await apiPatch(`/courses/${courseId}`, data);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      setDirtyFields(new Set());
    },
  });

  // ── Phase switch with dirty-check ──
  function switchToPhase(phase: Phase) {
    if (dirtyFields.size > 0) {
      setPendingPhase(phase);
      setShowUnsavedModal(true);
    } else {
      setActivePhase(phase);
    }
  }

  function handleUnsavedContinue() {
    setDirtyFields(new Set());
    setShowUnsavedModal(false);
    if (pendingPhase) setActivePhase(pendingPhase);
    setPendingPhase(null);
  }

  function handleUnsavedCancel() {
    setShowUnsavedModal(false);
    setPendingPhase(null);
  }

  // ── Mark field dirty ──
  const markDirty = useCallback((field: string) => {
    setDirtyFields((prev) => new Set(prev).add(field));
  }, []);

  // ── Save all ──
  const handleSaveAll = () => {
    // Delegate to the active phase's save function via ref callback.
    // PlanPhase registers its save fn into planSaveRef so we always
    // send the latest form state instead of stale query-cache data.
    if (activePhase === 1 && planSaveRef.current) {
      planSaveRef.current();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex">
        <aside className="sticky top-0 h-screen w-60 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <Skeleton className="mb-6 h-8 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </aside>
        <div className="flex-1 px-8 py-8">
          <Skeleton className="mb-6 h-8 w-64" />
          <div className="mx-auto max-w-4xl space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Card className="p-8">
            <Notice variant="danger">
              {(error as Error)?.message ?? "Course not found"}
            </Notice>
          </Card>
        </div>
      </div>
    );
  }

  const c = course;

  return (
    <div className="min-h-screen flex">
      {/* ── Sidebar ── */}
      <aside className="sticky top-0 h-screen w-60 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] p-5">
        {/* Back link */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 w-full justify-start gap-1.5"
          onClick={() => router.push("/dashboard/courses")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Courses
        </Button>

        {/* Phase list */}
        <nav className="space-y-1">
          {PHASES.map((phase) => {
            const isActive = activePhase === phase.id;
            const isComplete =
              (phase.id === 1 && !!c.title && !!c.description) ||
              (phase.id === 2 && c.modules.length > 0) ||
              (phase.id === 3 && c.status === "published");
            return (
              <button
                key={phase.id}
                onClick={() => switchToPhase(phase.id)}
                className={`
                  flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[0_8px_20px_-8px_var(--color-primary)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  }
                `}
              >
                <span
                  className={`
                  flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold
                  ${
                    isActive
                      ? "bg-white/20 text-white"
                      : isComplete
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                  }
                `}
                >
                  {isActive ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : isComplete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    phase.id
                  )}
                </span>
                <span className="flex-1">{phase.label}</span>
                {!isActive && dirtyFields.size > 0 && (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer — save */}
        <div className="absolute bottom-6 left-5 right-5 space-y-2">
          {saveError && (
            <Notice variant="danger" className="text-xs">
              {saveError}
            </Notice>
          )}
          <Button
            className="w-full"
            size="sm"
            disabled={isSaving || dirtyFields.size === 0}
            onClick={handleSaveAll}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving…" : "Save All"}
          </Button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 px-8 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{c.title}</h1>
            <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            {dirtyFields.size > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Phase content */}
        <div className="mx-auto max-w-4xl">
          {activePhase === 1 && (
            <PlanPhase course={c} onFieldChange={markDirty} onSaveRef={planSaveRef} />
          )}
          {activePhase === 2 && <CurriculumPhase course={c} />}
          {activePhase === 3 && <LandingPhase course={c} />}
        </div>
      </main>

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={showUnsavedModal}
        onContinue={handleUnsavedContinue}
        onCancel={handleUnsavedCancel}
      />
    </div>
  );
}
