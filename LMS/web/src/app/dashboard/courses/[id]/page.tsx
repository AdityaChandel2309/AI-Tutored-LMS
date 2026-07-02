"use client";

import { use, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProgressBar } from "@/components/progress/progress-bar";
import { PlayerSidebar } from "@/components/course-player/player-sidebar";
import { CourseTutorPanel } from "@/components/ai/course-tutor-panel";
import {
  LessonContent,
  LessonPlaceholder,
} from "@/components/course-player/lesson-content";
import {
  useCourse,
  useCourseProgress,
  useUpdateProgress,
  useCompleteLesson,
} from "@/lib/api/courses";
import { useMyCertificates } from "@/lib/api/certificates";
import { apiGet } from "@/lib/api/client";
import type { Lesson, CertificatePdfResponse } from "@/lib/types/course";

// ─── Resume state persistence ──────────────
// Stores the last active lesson per course in localStorage
// so learners can resume where they left off.

function getResumeKey(courseId: string) {
  return `lms:resume:${courseId}`;
}

function saveResumeState(
  courseId: string,
  lessonId: string,
) {
  try {
    localStorage.setItem(
      getResumeKey(courseId),
      lessonId,
    );
  } catch {
    /* localStorage may be unavailable */
  }
}

function loadResumeState(
  courseId: string,
): string | null {
  try {
    return localStorage.getItem(
      getResumeKey(courseId),
    );
  } catch {
    return null;
  }
}

// ─── Flatten lessons helper ────────────────

function flattenLessons(
  modules: { order: number; lessons: Lesson[] }[],
): Lesson[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .flatMap((m) =>
      [...m.lessons].sort(
        (a, b) => a.order - b.order,
      ),
    );
}

// ─── Certificate Badge ─────────────────────

function CertificateBadge({ courseId }: { courseId: string }) {
  const { data: certificates } = useMyCertificates();
  const cert = certificates?.find(
    (c) => c.template?.courseId === courseId,
  );

  if (!cert) return null;

  async function downloadPdf() {
    if (!cert) return;
    try {
      const { url } = await apiGet<CertificatePdfResponse>(
        `/certificates/${cert.id}/pdf`,
      );
      window.open(url, "_blank");
    } catch {
      // silent fail
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 py-3">
      <span className="text-2xl">🏆</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--color-foreground)]">
          Certificate Earned!
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {cert.certificateNumber} • Completed{" "}
          {new Date(cert.completionDate).toLocaleDateString()}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={downloadPdf}
      >
        📄 Download
      </Button>
    </div>
  );
}

// ─── Page Component ────────────────────────

export default function CoursePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // ── Data queries ──
  const {
    data: course,
    isLoading: courseLoading,
    error: courseError,
  } = useCourse(id);

  const { data: progress } =
    useCourseProgress(id);

  const progressMut = useUpdateProgress(id);
  const completeLessonMut = useCompleteLesson(id);

  // ── Derived flat lesson list ──
  const allLessons = useMemo(
    () =>
      course ? flattenLessons(course.modules) : [],
    [course],
  );

  // ── Active lesson source (hash-resume-progress fallback) ──
  const [hashLessonId, setHashLessonId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.location.hash.slice(1) || null;
  });

  const activeLessonId = useMemo(() => {
    if (allLessons.length === 0) return null;
    if (hashLessonId && allLessons.some((l) => l.id === hashLessonId)) {
      return hashLessonId;
    }
    const resumeId = loadResumeState(id);
    if (resumeId && allLessons.some((l) => l.id === resumeId)) {
      return resumeId;
    }
    if (progress) {
      const firstIncomplete = allLessons.find((l) => {
        const p = progress.lessons.find((lp) => lp.lessonId === l.id);
        return !p || p.state !== "completed";
      });
      return firstIncomplete?.id ?? allLessons[0]?.id ?? null;
    }
    return allLessons[0]?.id ?? null;
  }, [allLessons, hashLessonId, progress, id]);

  const activeLesson = useMemo(
    () =>
      allLessons.find(
        (l) => l.id === activeLessonId,
      ) ?? null,
    [allLessons, activeLessonId],
  );

  // ── Navigation index ──
  const activeIndex = useMemo(
    () =>
      activeLessonId
        ? allLessons.findIndex(
            (l) => l.id === activeLessonId,
          )
        : -1,
    [allLessons, activeLessonId],
  );

  // ── Module title for the active lesson (for the lesson header breadcrumb) ──
  const activeModuleTitle = useMemo(() => {
    if (!course || !activeLessonId) return undefined;
    const mod = course.modules.find((m) =>
      m.lessons.some((l) => l.id === activeLessonId),
    );
    return mod?.title;
  }, [course, activeLessonId]);

  const hasPrev = activeIndex > 0;
  const hasNext =
    activeIndex >= 0 &&
    activeIndex < allLessons.length - 1;

  // ── Lesson selection with resume + hash ──
  const selectLesson = useCallback(
    (lesson: Lesson) => {
      window.location.hash = lesson.id;
      saveResumeState(id, lesson.id);
      // Force re-render by updating hash
      window.dispatchEvent(
        new HashChangeEvent("hashchange"),
      );
    },
    [id],
  );

  // ── Auto-mark in_progress when lesson is viewed ──
  const progressMutRef = useRef(progressMut);

  useEffect(() => {
    progressMutRef.current = progressMut;
  }, [progressMut]);

  useEffect(() => {
    if (!activeLessonId || !progress) return;
    const lessonState = progress.lessons.find(
      (p) => p.lessonId === activeLessonId,
    );
    if (
      !lessonState ||
      lessonState.state === "not_started"
    ) {
      progressMutRef.current.mutate({
        lessonId: activeLessonId,
        state: "in_progress",
        progress: 0.5,
      });
    }
    saveResumeState(id, activeLessonId);
  }, [activeLessonId, progress, id]);

  // ── Hash change listener for navigation ──
  useEffect(() => {
    function onHashChange() {
      setHashLessonId(window.location.hash.slice(1) || null);
    }
    window.addEventListener(
      "hashchange",
      onHashChange,
    );
    return () =>
      window.removeEventListener(
        "hashchange",
        onHashChange,
      );
  }, []);

  // ── Lesson state helper ──
  function getLessonState(
    lessonId: string,
  ): string {
    return (
      progress?.lessons.find(
        (l) => l.lessonId === lessonId,
      )?.state ?? "not_started"
    );
  }

  // ── Navigation handlers ──
  function navigatePrev() {
    if (hasPrev) {
      selectLesson(allLessons[activeIndex - 1]);
    }
  }

  function navigateNext() {
    if (hasNext) {
      selectLesson(allLessons[activeIndex + 1]);
    }
  }

  function markComplete() {
    if (!activeLessonId) return;
    // Idempotent: the backend won't re-emit completion for an already-complete
    // lesson, so it's safe even if an auto-tracker fires more than once.
    // Completions flow through the xAPI-style endpoint.
    completeLessonMut.mutate(
      {
        lessonId: activeLessonId,
      },
      {
        onSuccess: () => {
          // Auto-advance to next lesson after completion
          if (hasNext) {
            setTimeout(() => {
              selectLesson(
                allLessons[activeIndex + 1],
              );
            }, 800);
          }
        },
      },
    );
  }

  // ── Loading/Error states ──
  if (courseLoading) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <Card className="p-8">
            <Notice>Loading course…</Notice>
          </Card>
        </div>
      </main>
    );
  }

  if (courseError || !course) {
    return (
      <main className="min-h-screen px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <Card className="p-8">
            <Notice variant="danger">
              {(courseError as Error)?.message ??
                "Course not found"}
            </Notice>
          </Card>
        </div>
      </main>
    );
  }

  const overallPct = progress?.summary
    ? Math.round(
        progress.summary.progress * 100,
      )
    : 0;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Course Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
          <SectionHeading
            badge={
              <Badge variant="success">
                Course
              </Badge>
            }
            title={course.title}
            description={
              course.description ??
              "No description"
            }
            actions={
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(
                      "/dashboard/my-courses",
                    )
                  }
                >
                  My Courses
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      "/dashboard/courses",
                    )
                  }
                >
                  ← Catalog
                </Button>
              </div>
            }
          />

          {/* Overall progress */}
          {progress && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[var(--color-muted-foreground)]">
                <span>Overall Progress</span>
                <span className="font-medium tabular-nums">
                  {overallPct}% •{" "}
                  {progress.summary.completed}/
                  {progress.summary.total} lessons
                </span>
              </div>
              <ProgressBar
                value={
                  progress.summary.progress
                }
                showLabel={false}
              />
            </div>
          )}

          {/* Certificate Earned Badge */}
          <CertificateBadge courseId={id} />
        </Card>

        {/* Player layout */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Sidebar */}
          <PlayerSidebar
            modules={course.modules}
            lessonProgress={
              progress?.lessons ?? []
            }
            activeLessonId={activeLessonId}
            onSelectLesson={selectLesson}
          />

          {/* Content */}
          {activeLesson ? (
            <LessonContent
              lesson={activeLesson}
              courseId={id}
              state={getLessonState(
                activeLesson.id,
              )}
              isMarkingProgress={
                progressMut.isPending ||
                completeLessonMut.isPending
              }
              onCompleteLesson={markComplete}
              onNavigatePrev={navigatePrev}
              onNavigateNext={navigateNext}
              hasPrev={hasPrev}
              hasNext={hasNext}
              lessonNumber={activeIndex + 1}
              totalLessons={allLessons.length}
              moduleTitle={activeModuleTitle}
            />
          ) : (
            <LessonPlaceholder />
          )}
        </div>
      </div>

      {/* Course-contextual AI tutor — only for enrolled learners, since the
          backend guards the tutor endpoint behind enrollment. */}
      {progress && (
        <CourseTutorPanel
          courseId={id}
          lessonId={activeLessonId}
        />
      )}
    </main>
  );
}
