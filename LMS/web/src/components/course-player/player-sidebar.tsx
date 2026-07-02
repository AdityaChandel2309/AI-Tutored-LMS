"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { CheckCircle2, Circle, Lock } from "lucide-react";
import {
  formatDuration,
  LessonTypeIcon,
} from "@/components/course-player/lesson-meta";
import type {
  CourseModule,
  Lesson,
  LessonProgress,
} from "@/lib/types/course";

export function PlayerSidebar({
  modules,
  lessonProgress,
  activeLessonId,
  onSelectLesson,
}: {
  modules: CourseModule[];
  lessonProgress: LessonProgress[];
  activeLessonId: string | null;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const sorted = useMemo(
    () => [...modules].sort((a, b) => a.order - b.order),
    [modules],
  );

  const stateByLesson = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of lessonProgress) {
      map.set(p.lessonId, p.state);
    }
    return map;
  }, [lessonProgress]);

  function getState(lessonId: string): string {
    return stateByLesson.get(lessonId) ?? "not_started";
  }

  if (sorted.length === 0) {
    return (
      <Card className="p-4">
        <Notice>No modules yet.</Notice>
      </Card>
    );
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div className="px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Course content
        </h3>
      </div>

      {sorted.map((mod) => {
        const lessons = [...mod.lessons].sort(
          (a, b) => a.order - b.order,
        );
        const completedCount = lessons.filter(
          (l) => getState(l.id) === "completed",
        ).length;
        const moduleSeconds = lessons.reduce(
          (sum, l) => sum + (l.duration ?? 0),
          0,
        );
        const moduleDuration = formatDuration(moduleSeconds);

        return (
          <Card key={mod.id} className="overflow-hidden p-0">
            {/* Module header */}
            <div className="border-b border-[var(--color-border)] bg-[var(--color-card-muted)] px-4 py-3">
              <h4 className="text-sm font-semibold leading-tight tracking-tight text-[var(--color-foreground)]">
                {mod.order}. {mod.title}
              </h4>
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {completedCount}/{lessons.length} completed
                {moduleDuration ? ` • ${moduleDuration}` : ""}
              </p>
            </div>

            {/* Lessons */}
            <ul className="divide-y divide-[var(--color-border)]">
              {lessons.map((lesson) => {
                const state = getState(lesson.id);
                const isActive = activeLessonId === lesson.id;
                const isCompleted = state === "completed";
                const isLocked = state === "locked";
                const lessonDuration = formatDuration(
                  lesson.duration,
                );

                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={isLocked}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => onSelectLesson(lesson)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? "bg-[var(--color-primary-soft)]"
                          : "hover:bg-[var(--color-muted)]"
                      }`}
                    >
                      {/* Status icon */}
                      <span className="mt-0.5 flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2
                            className="h-4 w-4 text-[var(--color-accent)]"
                            aria-label="Completed"
                          />
                        ) : isLocked ? (
                          <Lock
                            className="h-4 w-4 text-[var(--color-muted-foreground)]"
                            aria-label="Locked"
                          />
                        ) : (
                          <Circle
                            className={`h-4 w-4 ${
                              state === "in_progress"
                                ? "text-[var(--color-primary)]"
                                : "text-[var(--color-muted-foreground)] opacity-50"
                            }`}
                            aria-label={
                              state === "in_progress"
                                ? "In progress"
                                : "Not started"
                            }
                          />
                        )}
                      </span>

                      {/* Title + meta */}
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            isActive
                              ? "font-semibold text-[var(--color-primary)]"
                              : isCompleted
                                ? "text-[var(--color-muted-foreground)]"
                                : "text-[var(--color-foreground)]"
                          }`}
                        >
                          {lesson.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                          <LessonTypeIcon
                            type={lesson.type}
                            className="h-3 w-3"
                          />
                          {lessonDuration ?? "—"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </aside>
  );
}
