"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  useCategories,
  useCreateCourse,
} from "@/lib/api/courses";

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

export default function CreateCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [validationError, setValidationError] =
    useState<string | null>(null);

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useCategories();

  const createMut = useCreateCourse();

  const trimmedTitle = title.trim();
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= TITLE_MAX &&
    description.length <= DESCRIPTION_MAX &&
    !createMut.isPending;

  function handleCreate() {
    setValidationError(null);

    if (!trimmedTitle) {
      setValidationError("Course title is required.");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setValidationError(
        `Course title must be ${TITLE_MAX} characters or fewer.`,
      );
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setValidationError(
        `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
      );
      return;
    }

    createMut.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        categoryId: categoryId || undefined,
      },
      {
        onSuccess: (course) => {
          router.push(
            `/dashboard/courses/${course.id}/edit`,
          );
        },
      },
    );
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
          <SectionHeading
            badge={<Badge variant="warning">New</Badge>}
            title="Create Course"
            description="Start a new course — you can add modules and lessons after creation."
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push("/dashboard/courses")
                }
              >
                ← Catalog
              </Button>
            }
          />
        </Card>

        <Card>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="course-title"
                  className="block text-xs font-medium text-[var(--color-muted-foreground)]"
                >
                  Course Title *
                </label>
                <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
                  {trimmedTitle.length}/{TITLE_MAX}
                </span>
              </div>
              <Input
                id="course-title"
                placeholder="e.g. Introduction to Machine Learning"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div>
              <label
                htmlFor="course-description"
                className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]"
              >
                Description
              </label>
              <textarea
                id="course-description"
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                rows={4}
                maxLength={DESCRIPTION_MAX}
                placeholder="A brief overview of what this course covers…"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </div>

            <div>
              <label
                htmlFor="course-category"
                className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]"
              >
                Category
              </label>
              <select
                id="course-category"
                className="h-11 w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60"
                value={categoryId}
                disabled={categoriesLoading}
                onChange={(e) =>
                  setCategoryId(e.target.value)
                }
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories…"
                    : "No category"}
                </option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {categoriesError && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">
                  Couldn&apos;t load categories. You can
                  still create the course without one.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                disabled={!canSubmit}
                onClick={handleCreate}
                className="flex-1"
              >
                {createMut.isPending
                  ? "Creating…"
                  : "Create Course"}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  router.push("/dashboard/courses")
                }
              >
                Cancel
              </Button>
            </div>

            {validationError && (
              <Notice variant="warning">
                {validationError}
              </Notice>
            )}

            {createMut.isError && (
              <Notice variant="danger">
                {createMut.error instanceof Error
                  ? createMut.error.message
                  : "Something went wrong creating the course."}
              </Notice>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
