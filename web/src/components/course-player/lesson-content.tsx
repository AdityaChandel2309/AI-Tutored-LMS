"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { VideoPlayer } from "@/components/course-player/video-player";
import { ScormPlayer } from "@/components/course-player/scorm-player";
import { TextLessonReader } from "@/components/course-player/text-lesson-reader";
import { LessonResources } from "@/components/course-player/lesson-resources";
import { QuizPlayer } from "@/components/assessment/quiz-player";
import {
  formatDuration,
  LessonTypeIcon,
  lessonTypeLabel,
} from "@/components/course-player/lesson-meta";
import type {
  Lesson,
  VideoLessonContent,
  ScormLessonContent,
} from "@/lib/types/course";

// Quiz completion is gated on passing the quiz itself, so we don't offer a
// manual "mark complete" shortcut for it. Every other lesson type requires an
// explicit click on the "Complete & Continue" button — no auto-completion.
const MANUAL_COMPLETE_TYPES = new Set([
  "text",
  "video",
  "scorm",
  "assignment",
  "reading",
]);

export function LessonContent({
  lesson,
  courseId,
  state,
  isMarkingProgress,
  onCompleteLesson,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  lessonNumber,
  totalLessons,
  moduleTitle,
}: {
  lesson: Lesson;
  courseId: string;
  state: string;
  isMarkingProgress: boolean;
  onCompleteLesson: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  lessonNumber?: number;
  totalLessons?: number;
  moduleTitle?: string;
}) {
  const isCompleted = state === "completed";
  const canManuallyComplete = MANUAL_COMPLETE_TYPES.has(lesson.type);

  const stateVariant =
    state === "completed"
      ? "success"
      : state === "in_progress"
        ? "warning"
        : "neutral";

  const durationLabel = formatDuration(lesson.duration);

  const videoContent =
    lesson.type === "video" ? parseVideoContent(lesson.content) : null;
  const scormContent =
    lesson.type === "scorm" ? parseScormContent(lesson.content) : null;

  return (
    <Card className="flex min-h-[400px] flex-col p-0">
      {/* ── Lesson header ── */}
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        {(moduleTitle || (lessonNumber && totalLessons)) && (
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {moduleTitle}
            {moduleTitle && lessonNumber ? " • " : ""}
            {lessonNumber && totalLessons
              ? `Lesson ${lessonNumber} of ${totalLessons}`
              : ""}
          </p>
        )}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {lesson.title}
          </h2>
          <Badge variant={stateVariant}>
            {state.replace("_", " ")}
          </Badge>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          <span className="inline-flex items-center gap-1.5">
            <LessonTypeIcon type={lesson.type} className="h-3.5 w-3.5" />
            {lessonTypeLabel(lesson.type)}
          </span>
          {durationLabel && (
            <>
              <span aria-hidden>•</span>
              <span>{durationLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Lesson content area ── */}
      <div className="flex-1 px-6 py-6">
        {lesson.type === "video" ? (
          videoContent?.videoId ? (
            <VideoPlayer
              videoId={videoContent.videoId}
              posterUrl={videoContent.posterUrl}
            />
          ) : videoContent?.externalUrl ? (
            <ExternalVideoPlayer
              externalUrl={videoContent.externalUrl}
              posterUrl={videoContent.posterUrl}
            />
          ) : (
            <Notice>No video attached yet.</Notice>
          )
        ) : lesson.type === "scorm" ? (
          scormContent?.scormPackageId ? (
            <ScormPlayer packageId={scormContent.scormPackageId} />
          ) : (
            <Notice>No SCORM package attached yet.</Notice>
          )
        ) : lesson.type === "quiz" ? (
          <QuizPlayer
            lessonId={lesson.id}
            courseId={courseId}
            onCompleted={onCompleteLesson}
          />
        ) : lesson.type === "text" || lesson.type === "reading" ? (
          <TextLessonReader
            content={lesson.content}
            alreadyComplete={isCompleted}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)] p-8 text-sm text-[var(--color-muted-foreground)]">
            {renderFallbackContent(lesson.content)}
          </div>
        )}

        {/* Completion hint */}
        {!isCompleted && lesson.type === "quiz" && (
          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            Pass the quiz to complete this lesson.
          </p>
        )}

        <LessonResources lessonId={lesson.id} />
      </div>

      {/* ── Footer action bar ── */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-4">
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasPrev}
          onClick={onNavigatePrev}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>

        {/* Primary action: always lets the learner move progress forward. */}
        {isCompleted ? (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Completed
            </span>
            {hasNext && (
              <Button size="sm" onClick={onNavigateNext}>
                Next lesson
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        ) : canManuallyComplete ? (
          <Button
            size="sm"
            disabled={isMarkingProgress}
            onClick={onCompleteLesson}
          >
            {isMarkingProgress ? (
              "Saving…"
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {hasNext ? "Complete & Continue" : "Complete"}
              </>
            )}
          </Button>
        ) : (
          // Quiz: completion comes from passing; just offer forward nav.
          <Button
            size="sm"
            variant={hasNext ? "default" : "ghost"}
            disabled={!hasNext}
            onClick={onNavigateNext}
          >
            Next lesson
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
}

function ExternalVideoPlayer({
  externalUrl,
  posterUrl,
}: {
  externalUrl: string;
  posterUrl?: string | null;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="space-y-3">
      <video
        controls
        playsInline
        className="w-full rounded-xl border border-[var(--color-border)] bg-black"
        src={externalUrl}
        poster={posterUrl ?? undefined}
        onError={() => setHasError(true)}
      />
      {hasError && (
        <Notice variant="danger">
          This external video could not be loaded. Try another video URL or upload the video to the course library.
        </Notice>
      )}
    </div>
  );
}

export function LessonPlaceholder() {
  return (
    <Card className="flex min-h-[400px] items-center justify-center p-6 text-center">
      <div className="space-y-2">
        <p className="text-lg font-medium text-[var(--color-muted-foreground)]">
          Select a lesson to begin
        </p>
        <p className="text-sm text-[var(--color-muted-foreground)] opacity-60">
          Choose from the course content on the left
        </p>
      </div>
    </Card>
  );
}

function parseVideoContent(
  content: Lesson["content"],
): VideoLessonContent | null {
  if (!content || typeof content !== "object") {
    return null;
  }

  const value = content as Record<string, unknown>;
  const videoId = typeof value.videoId === "string" ? value.videoId : undefined;
  const externalUrl =
    typeof value.externalUrl === "string" ? value.externalUrl : null;
  if (!videoId && !externalUrl) {
    return null;
  }
  return {
    videoId,
    externalUrl,
    posterUrl:
      typeof value.posterUrl === "string" ? value.posterUrl : null,
  };
}

function parseScormContent(
  content: Lesson["content"],
): ScormLessonContent | null {
  if (!content || typeof content !== "object") {
    return null;
  }

  const value = content as Record<string, unknown>;
  if (typeof value.scormPackageId !== "string") {
    return null;
  }

  return {
    scormPackageId: value.scormPackageId,
  };
}

// Renders content for lesson types that aren't specially handled (e.g.
// assignment) as readable prose, falling back to a friendly placeholder.
function renderFallbackContent(content: Lesson["content"]) {
  let text: string | null = null;

  if (typeof content === "string") {
    text = content;
  } else if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    if (typeof value.body === "string") {
      text = value.body;
    }
  }

  if (!text || !text.trim()) {
    return (
      <p className="text-center">
        Lesson content will be available soon.
      </p>
    );
  }

  return (
    <div className="whitespace-pre-wrap text-left leading-relaxed text-[var(--color-foreground)]">
      {text}
    </div>
  );
}
