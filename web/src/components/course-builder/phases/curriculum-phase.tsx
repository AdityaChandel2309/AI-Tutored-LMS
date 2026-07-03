"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Plus,
  Trash2,
  X as XIcon,
  Layout as LayoutIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useAddModule,
  useDeleteModule,
  useDeleteLesson,
  useReorderModules,
} from "@/lib/api/courses";
import { SortableModuleItem, type Module, type Lesson } from "@/components/course-builder/sortable-module-item";

// ─── Types ───────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  modules: Module[];
};

// ─── Curriculum Phase ────────────────────────────────

export function CurriculumPhase({ course }: { course: Course }) {
  const qc = useQueryClient();
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  const addModule = useAddModule(course.id);
  const deleteModule = useDeleteModule(course.id);
  const deleteLesson = useDeleteLesson(course.id);
  const reorderModules = useReorderModules(course.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);

  const handleToggleLesson = useCallback((id: string) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setShowBulkBar(next.size > 0);
      return next;
    });
  }, []);

  const handleToggleAllLessons = useCallback(
    (module: Module) => {
      setSelectedLessonIds((prev) => {
        const next = new Set(prev);
        const allInModule = module.lessons.map((l: Lesson) => l.id);
        const allSelected = allInModule.every((id: string) => prev.has(id));
        if (allSelected) {
          allInModule.forEach((id: string) => next.delete(id));
        } else {
          allInModule.forEach((id: string) => next.add(id));
        }
        setShowBulkBar(next.size > 0);
        return next;
      });
    },
    [],
  );

  function handleDeleteSelected() {
    const ids = Array.from(selectedLessonIds);
    if (!confirm(`Delete ${ids.length} lecture${ids.length !== 1 ? "s" : ""}?`)) return;
    ids.forEach((id) => deleteLesson.mutate(id));
    setSelectedLessonIds(new Set());
    setShowBulkBar(false);
  }

  function handleAddSection() {
    if (!sectionTitle.trim()) return;
    addModule.mutate(sectionTitle.trim(), {
      onSuccess: () => {
        setSectionTitle("");
        setLearningObjective("");
        setShowSectionForm(false);
      },
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeModuleIndex = sortedModules.findIndex((m) => m.id === active.id);
    const overModuleIndex = sortedModules.findIndex((m) => m.id === over.id);

    if (activeModuleIndex !== -1 && overModuleIndex !== -1) {
      // Reordering modules at the top level
      const reordered = arrayMove(sortedModules, activeModuleIndex, overModuleIndex);
      reorderModules.mutate(reordered.map((m: Module) => m.id));
    }
    // Lesson reordering within a module is handled by each module's own DndContext
  }

  const hasError = deleteModule.isError || deleteLesson.isError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
            Curriculum
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            Build your course in sections, each focused on a single learning
            objective. Add lectures, activities, and assessments.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] sm:inline-flex">
          {sortedModules.length} section{sortedModules.length === 1 ? "" : "s"}
          {" • "}
          {sortedModules.reduce((sum, m) => sum + m.lessons.length, 0)} lectures
        </span>
      </div>

      {/* Module list — top-level DnD for module reordering */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedModules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sortedModules.length === 0 && (
              <Card className="border-dashed py-10">
                <EmptyState
                  icon={LayoutIcon}
                  title="Build your curriculum"
                  description="Break your course into sections and lectures so learners can navigate the content."
                  action={
                    <Button size="sm" onClick={() => setShowSectionForm(true)}>
                      <Plus className="h-4 w-4" aria-hidden />
                      Create your first section
                    </Button>
                  }
                />
              </Card>
            )}
            {sortedModules.map((mod) => (
              <SortableModuleItem
                key={mod.id}
                module={mod}
                courseId={course.id}
                selectedLessonIds={selectedLessonIds}
                onToggleLesson={handleToggleLesson}
                allSelected={
                  mod.lessons.length > 0 &&
                  mod.lessons.every((l) => selectedLessonIds.has(l.id))
                }
                onToggleAll={() => handleToggleAllLessons(mod)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ─── Inline Section Form (Udemy-style) ─── */}
      {showSectionForm ? (
        <div>
          <button
            onClick={() => {
              setShowSectionForm(false);
              setSectionTitle("");
              setLearningObjective("");
            }}
            className="mb-2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 space-y-4">
            {/* Title */}
            <div className="flex items-start gap-3">
              <span className="mt-2 text-sm font-bold whitespace-nowrap">
                New Section:
              </span>
              <div className="flex-1">
                <div className="relative">
                  <Input
                    placeholder="Enter a Title"
                    value={sectionTitle}
                    onChange={(e) => {
                      if (e.target.value.length <= 80) setSectionTitle(e.target.value);
                    }}
                    className="pr-12"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddSection();
                      if (e.key === "Escape") {
                        setShowSectionForm(false);
                        setSectionTitle("");
                        setLearningObjective("");
                      }
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted-foreground)]">
                    {80 - sectionTitle.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Learning Objective */}
            <div>
              <p className="mb-1.5 text-sm text-[var(--color-muted-foreground)]">
                What will students be able to do at the end of this section?
              </p>
              <div className="relative">
                <Input
                  placeholder="Enter a Learning Objective"
                  value={learningObjective}
                  onChange={(e) => {
                    if (e.target.value.length <= 200)
                      setLearningObjective(e.target.value);
                  }}
                  className="pr-12"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSection();
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted-foreground)]">
                  {200 - learningObjective.length}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSectionForm(false);
                  setSectionTitle("");
                  setLearningObjective("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={addModule.isPending || !sectionTitle.trim()}
                onClick={handleAddSection}
              >
                {addModule.isPending ? "Adding…" : "Add Section"}
              </Button>
            </div>

            {addModule.error && (
              <p className="text-xs text-[var(--color-danger)]">
                {(addModule.error as Error).message}
              </p>
            )}
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSectionForm(true)}
          className="border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
        >
          <Plus className="h-4 w-4" />
          Section
        </Button>
      )}

      {hasError && (
        <Notice variant="danger">
          {(deleteModule.error ?? deleteLesson.error as Error)?.message}
        </Notice>
      )}

      {/* Bulk action bar */}
      {showBulkBar && selectedLessonIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 shadow-2xl">
          <span className="text-sm font-medium text-[var(--color-foreground)]">
            {selectedLessonIds.size} selected
          </span>
          <Button size="sm" variant="danger" onClick={handleDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </Button>
          <button
            onClick={() => {
              setSelectedLessonIds(new Set());
              setShowBulkBar(false);
            }}
            className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tips card */}
      <Card className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
        <h3 className="mb-2 text-base font-semibold tracking-tight text-[var(--color-foreground)]">
          Building Curriculum Tips
        </h3>
        <ul className="space-y-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          <li>• <strong className="text-[var(--color-foreground)]">Sections</strong> group related lectures together</li>
          <li>• <strong className="text-[var(--color-foreground)]">Lectures</strong> are individual content pieces (video, text, quiz…)</li>
          <li>• Drag the grip handle to reorder sections or lectures within a section</li>
          <li>• Click the checkbox to select multiple lectures for bulk actions</li>
        </ul>
      </Card>
    </div>
  );
}
