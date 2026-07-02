"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileVideo, FileCode, BookText, HelpCircle, Link2, ChevronLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPatch } from "@/lib/api/client";
import { VideoUpload } from "@/components/course-editor/video-upload";
import { ScormUpload } from "@/components/course-editor/scorm-upload";
import { QuizEditor } from "@/components/assessment/quiz-editor";
import { RichTextEditor } from "@/components/course-builder/rich-text-editor";

type LessonType = "text" | "video" | "scorm" | "quiz" | "assignment";

type LessonContent = {
  title?: string;
  description?: string;
  transcript?: boolean;
  closedCaptions?: boolean;
  videoId?: string;
  scormPackageId?: string;
  articleContent?: string;
};

const LESSON_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <BookText className="h-4 w-4 text-blue-500" />,
  video: <FileVideo className="h-4 w-4 text-purple-500" />,
  scorm: <FileCode className="h-4 w-4 text-amber-500" />,
  quiz: <HelpCircle className="h-4 w-4 text-green-500" />,
  assignment: <FileText className="h-4 w-4 text-rose-500" />,
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  video: "Video",
  scorm: "SCORM",
  quiz: "Quiz",
  assignment: "Assignment",
  audio: "Audio",
  article: "Article",
  pdf: "PDF",
  ppt: "PPT",
  "practice-test": "Practice Test",
  "coding-exercise": "Coding Exercise",
};

function FileText({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}

interface LectureEditorProps {
  lesson: {
    id: string;
    title: string;
    type: string;
    content?: LessonContent | null;
  };
  courseId: string;
  onBack?: () => void;
}

export function LectureEditor({ lesson, courseId, onBack }: LectureEditorProps) {
  const qc = useQueryClient();

  const [titleValue, setTitleValue] = useState(lesson.title);
  const [descValue, setDescValue] = useState(
    (lesson.content as LessonContent)?.description ?? "",
  );
  const [transcript, setTranscript] = useState(
    (lesson.content as LessonContent)?.transcript ?? false,
  );
  const [closedCaptions, setClosedCaptions] = useState(
    (lesson.content as LessonContent)?.closedCaptions ?? false,
  );
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);
  const [preview, setPreview] = useState(false);
  const [articleContent, setArticleContent] = useState(
    (lesson.content as LessonContent)?.articleContent as string ?? "",
  );

  // Sync when lesson changes
  useEffect(() => {
    setTitleValue(lesson.title);
    setDescValue((lesson.content as LessonContent)?.description ?? "");
    setTranscript((lesson.content as LessonContent)?.transcript ?? false);
    setClosedCaptions((lesson.content as LessonContent)?.closedCaptions ?? false);
    setArticleContent((lesson.content as LessonContent)?.articleContent as string ?? "");
  }, [lesson.id, lesson.title, lesson.content]);

  function saveLessonContent(patch: Partial<LessonContent>) {
    return apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content as LessonContent ?? {}),
        ...patch,
      },
    });
  }

  function handleArticleContentBlur() {
    apiPatch(`/lessons/${lesson.id}`, {
      content: {
        ...(lesson.content as LessonContent ?? {}),
        articleContent,
      },
    }).then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }));
  }

  function handleTitleBlur() {
    if (titleValue.trim() === lesson.title || !titleValue.trim()) {
      setTitleValue(lesson.title);
      return;
    }
    setSavingTitle(true);
    apiPatch(`/lessons/${lesson.id}`, { title: titleValue.trim() })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => setSavingTitle(false));
  }

  function handleDescBlur() {
    const prev = (lesson.content as LessonContent)?.description ?? "";
    if (descValue === prev) return;
    setSavingDesc(true);
    saveLessonContent({ description: descValue })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => setSavingDesc(false));
  }

  function handleTranscriptToggle() {
    const next = !transcript;
    setTranscript(next);
    saveLessonContent({ transcript: next });
  }

  function handleCcToggle() {
    const next = !closedCaptions;
    setClosedCaptions(next);
    saveLessonContent({ closedCaptions: next });
  }

  function getVideoId(content: unknown) {
    if (!content || typeof content !== "object") return null;
    return (content as Record<string, unknown>)["videoId"] as string | undefined;
  }

  function getScormId(content: unknown) {
    if (!content || typeof content !== "object") return null;
    return (content as Record<string, unknown>)["scormPackageId"] as string | undefined;
  }

  return (
    <div className="space-y-4">
      {/* Back to course link */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to course
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPreview(!preview)}
          className="gap-1.5 text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          {preview ? "Edit" : "Preview"}
        </Button>
      </div>

      {/* Header: icon + title */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0">
          {LESSON_TYPE_ICONS[lesson.type] ?? <BookText className="h-4 w-4" />}
        </span>
        <div className="flex-1 space-y-1">
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="border-0 border-b border-dashed border-[var(--color-border)] rounded-none bg-transparent px-0 py-1 text-base font-semibold shadow-none focus-visible:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-0"
            placeholder="Lecture title"
          />
          {savingTitle && (
            <p className="text-[10px] text-[var(--color-muted-foreground)]">Saving…</p>
          )}
        </div>
      </div>

      {/* Description textarea */}
      <div className="pl-7">
        <textarea
          value={descValue}
          onChange={(e) => setDescValue(e.target.value)}
          onBlur={handleDescBlur}
          placeholder="Add a description for this lecture…"
          rows={2}
          className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
        />
        {savingDesc && (
          <p className="text-[10px] text-[var(--color-muted-foreground)]">Saving…</p>
        )}
      </div>

      {/* Type-specific editor */}
      <div className="pl-7">
        {lesson.type === "video" && (
          <VideoUpload
            courseId={courseId}
            lessonId={lesson.id}
            lessonTitle={titleValue}
            existingVideoId={getVideoId(lesson.content) ?? null}
            onUploaded={() =>
              qc.invalidateQueries({ queryKey: ["course", courseId] })
            }
          />
        )}
        {lesson.type === "scorm" && (
          <ScormUpload
            courseId={courseId}
            lessonId={lesson.id}
            lessonTitle={titleValue}
            existingPackageId={getScormId(lesson.content) ?? null}
            onUploaded={() =>
              qc.invalidateQueries({ queryKey: ["course", courseId] })
            }
          />
        )}
        {lesson.type === "quiz" && (
          <QuizEditor lessonId={lesson.id} lessonTitle={titleValue} />
        )}
        {(lesson.type === "text" || lesson.type === "article") && (
          preview ? (
            <div className="rounded-lg border border-[var(--color-border)] p-4 min-h-[120px]">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: articleContent || "<p>No content yet</p>" }}
              />
            </div>
          ) : (
            <RichTextEditor
              content={articleContent}
              onChange={setArticleContent}
              onBlur={handleArticleContentBlur}
              placeholder="Write your lesson content here…"
              onPreview={() => setPreview(true)}
            />
          )
        )}
        {lesson.type === "assignment" && (
          <p className="text-xs italic text-[var(--color-muted-foreground)]">
            Assignment editor coming soon.
          </p>
        )}
        {(lesson.type === "audio" || lesson.type === "pdf" || lesson.type === "ppt" || lesson.type === "practice-test" || lesson.type === "coding-exercise") && (
          <p className="text-xs italic text-[var(--color-muted-foreground)]">
            {LESSON_TYPE_LABELS[lesson.type] ?? lesson.type} content editor coming soon.
          </p>
        )}
      </div>

      {/* Settings row: transcript + CC */}
      {lesson.type === "video" && (
        <div className="pl-7 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={transcript}
              onChange={handleTranscriptToggle}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <Link2 className="h-3 w-3" />
              Transcript
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={closedCaptions}
              onChange={handleCcToggle}
              className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
            />
            <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              Closed Captions
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
