"use client";

import { useState, useEffect, type MutableRefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useCategories, useUpdateCourse } from "@/lib/api/courses";
import { apiPatch } from "@/lib/api/client";
import { Check } from "lucide-react";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; name: string } | null;
};

export function PlanPhase({
  course,
  onFieldChange,
  onSaveRef,
}: {
  course: Course;
  onFieldChange?: (field: string) => void;
  onSaveRef?: MutableRefObject<(() => void) | null>;
}) {
  const qc = useQueryClient();

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [categoryId, setCategoryId] = useState(course.category?.id ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Sync when course prop changes
  useEffect(() => {
    setTitle(course.title);
    setDescription(course.description ?? "");
    setCategoryId(course.category?.id ?? "");
  }, [course]);

  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const updateMut = useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string;
      categoryId?: string;
    }) => apiPatch(`/courses/${course.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course", course.id] });
      setSaved(true);
      onFieldChange?.("plan");
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      setLocalError(err instanceof Error ? err.message : "Save failed");
    },
  });

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setLocalError("Course title is required.");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setLocalError(`Title must be ${TITLE_MAX} characters or fewer.`);
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setLocalError(`Description must be ${DESCRIPTION_MAX} characters or fewer.`);
      return;
    }
    setLocalError(null);
    updateMut.mutate({
      title: trimmedTitle,
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
    });
  }

  // Register save fn so the parent wizard's "Save All" can trigger it
  useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSave;
    }
    return () => {
      if (onSaveRef) {
        onSaveRef.current = null;
      }
    };
  });

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Course Details</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Set your course title, description, and category.
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Course Title *
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onFieldChange?.("title");
              }}
              maxLength={TITLE_MAX}
              placeholder="e.g. Introduction to Machine Learning"
              className="flex-1"
            />
            <span className="text-xs tabular-nums text-[var(--color-muted-foreground)] whitespace-nowrap">
              {title.length}/{TITLE_MAX}
            </span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Description
          </label>
          <textarea
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            rows={4}
            maxLength={DESCRIPTION_MAX}
            placeholder="A brief overview of what this course covers…"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              onFieldChange?.("description");
            }}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Shown to students on the course catalog page.
            </span>
            <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
            Category
          </label>
          <select
            className="h-11 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60"
            value={categoryId}
            disabled={categoriesLoading}
            onChange={(e) => {
              setCategoryId(e.target.value);
              onFieldChange?.("categoryId");
            }}
          >
            <option value="">
              {categoriesLoading ? "Loading categories…" : "No category"}
            </option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button
            disabled={updateMut.isPending}
            onClick={handleSave}
          >
            {updateMut.isPending ? "Saving…" : "Save Changes"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
        </div>

        {localError && <Notice variant="warning">{localError}</Notice>}
        {updateMut.isError && (
          <Notice variant="danger">
            {updateMut.error instanceof Error
              ? updateMut.error.message
              : "Save failed"}
          </Notice>
        )}
      </Card>

      {/* What's next card */}
      <Card className="bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
        <h3 className="mb-2 text-base font-semibold tracking-tight">
          Next: Build your Curriculum
        </h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Once you&apos;re happy with the course plan, move on to Phase 2 to add
          sections, lectures, and assessments to your course.
        </p>
      </Card>
    </div>
  );
}

