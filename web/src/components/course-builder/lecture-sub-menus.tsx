"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  PlayCircle,
  Layout,
  FileText,
  ChevronLeft,
  ChevronRight,
  Link2,
  Code,
  FolderOpen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPatch } from "@/lib/api/client";
import { RichTextEditor } from "@/components/course-builder/rich-text-editor";
import type { Lesson } from "@/components/course-builder/sortable-module-item";
import { ResourceUploader } from "@/components/course-editor/resource-upload";

// ─── Types ───────────────────────────────────────────

type ContentType = "video" | "video-slide" | "article";
type ResourceTab = "downloadable" | "library" | "external" | "sourcecode";

// ─── Lecture Description Menu (State A) ───────────────

interface LectureDescriptionMenuProps {
  lesson: Lesson;
  courseId: string;
  onClose: () => void;
}

export function LectureDescriptionMenu({
  lesson,
  courseId,
  onClose,
}: LectureDescriptionMenuProps) {
  const qc = useQueryClient();
  const existingDesc = (lesson.content?.description as string) ?? "";
  const [value, setValue] = useState(existingDesc);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    apiPatch(`/lessons/${lesson.id}`, {
      content: { ...(lesson.content ?? {}), description: value },
    })
      .then(() => qc.invalidateQueries({ queryKey: ["course", courseId] }))
      .finally(() => {
        setSaving(false);
        onClose();
      });
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-2">
        <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Lecture Description
        </p>
      </div>
      <RichTextEditor
        content={value}
        onChange={setValue}
        placeholder="Add a description for this lecture…"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Lecture Resources Menu (State B) ────────────────

interface LectureResourcesMenuProps {
  lesson: Lesson;
  courseId: string;
  onClose: () => void;
}

export function LectureResourcesMenu({
  lesson,
  courseId,
  onClose,
}: LectureResourcesMenuProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<ResourceTab>("downloadable");
  const [showRightChevron, setShowRightChevron] = useState(false);
  const [externalUrl, setExternalUrl] = useState(
    (lesson.content?.externalUrl as string) ?? "",
  );
  const [sourceCode, setSourceCode] = useState(
    (lesson.content?.sourceCode as string) ?? "",
  );
  const tabContainerRef = useRef<HTMLDivElement>(null);

  // Detect tab overflow
  useEffect(() => {
    const el = tabContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setShowRightChevron(el.scrollWidth > el.clientWidth);
    });
    observer.observe(el);
    // Initial check
    setShowRightChevron(el.scrollWidth > el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const TABS: { id: ResourceTab; label: string }[] = [
    { id: "downloadable", label: "Downloadable File" },
    { id: "library", label: "Add from library" },
    { id: "external", label: "External Resource" },
    { id: "sourcecode", label: "Source Code" },
  ];

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Add Resources
        </p>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <div className="relative flex items-center">
        <div
          ref={tabContainerRef}
          className="flex overflow-x-auto scrollbar-hide border-b border-[var(--color-border)]"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
              )}
            </button>
          ))}
        </div>

        {/* Right overflow chevron */}
        {showRightChevron && (
          <button
            onClick={() => {
              tabContainerRef.current?.scrollBy({ left: 200, behavior: "smooth" });
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded bg-[var(--color-card)] shadow border border-[var(--color-border)]"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === "downloadable" && (
          <ResourceUploader lessonId={lesson.id} />
        )}

        {activeTab === "library" && (
          <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 flex flex-col items-center justify-center gap-2">
            <FolderOpen className="h-8 w-8 text-[var(--color-muted-foreground)]" />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Select files from your library
            </p>
            <Button size="sm" variant="outline">
              Browse Library
            </Button>
          </div>
        )}

        {activeTab === "external" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
                Resource Label
              </label>
              <Input
                placeholder="e.g. Official Documentation"
                className="text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
                URL
              </label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com/resource"
                className="text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                apiPatch(`/lessons/${lesson.id}`, {
                  content: { ...(lesson.content ?? {}), externalUrl },
                }).then(() => {
                  qc.invalidateQueries({ queryKey: ["course", courseId] });
                  onClose();
                });
              }}
            >
              Save Resource
            </Button>
          </div>
        )}

        {activeTab === "sourcecode" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">
                Source Code Snippet
              </label>
              <textarea
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                placeholder="// Paste your code here…"
                rows={6}
                className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm font-mono text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                apiPatch(`/lessons/${lesson.id}`, {
                  content: { ...(lesson.content ?? {}), sourceCode },
                }).then(() => {
                  qc.invalidateQueries({ queryKey: ["course", courseId] });
                  onClose();
                });
              }}
            >
              Save Code
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lecture Lab Menu ───────────────────────────────

interface LectureLabMenuProps {
  onClose: () => void;
}

export function LectureLabMenu({ onClose }: LectureLabMenuProps) {
  return (
    <div className="px-4 pb-4">
      <p className="text-sm italic text-[var(--color-muted-foreground)]">
        Lab environment coming soon.
      </p>
    </div>
  );
}

// ─── Lecture Content Selector (State C) ─────────────

interface LectureContentSelectorProps {
  lesson: Lesson;
  courseId: string;
  onClose: () => void;
}

const CONTENT_TYPES: {
  id: ContentType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "video",
    label: "Video",
    icon: <PlayCircle className="h-8 w-8 text-purple-500" />,
    description: "Upload or record a video lesson",
  },
  {
    id: "video-slide",
    label: "Video & Slide Mashup",
    icon: <Layout className="h-8 w-8 text-purple-500" />,
    description: "Combine video with slides",
  },
  {
    id: "article",
    label: "Article",
    icon: <FileText className="h-8 w-8 text-purple-500" />,
    description: "Write a text-based lesson",
  },
];

export function LectureContentSelector({
  lesson,
  courseId,
  onClose,
}: LectureContentSelectorProps) {
  const qc = useQueryClient();

  function handleSelect(type: ContentType) {
    apiPatch(`/lessons/${lesson.id}`, { type }).then(() => {
      qc.invalidateQueries({ queryKey: ["course", courseId] });
      onClose();
    });
  }

  return (
    <div className="px-4 pb-4">
      {/* Toggleable header */}
      <button
        onClick={onClose}
        className="mb-3 flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Select content type
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">✕</span>
      </button>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-3">
        {CONTENT_TYPES.map((ct) => (
          <button
            key={ct.id}
            onClick={() => handleSelect(ct.id)}
            className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center transition-all hover:border-[var(--color-primary)] hover:shadow-md"
          >
            {ct.icon}
            <span className="text-sm font-semibold">{ct.label}</span>
            <span className="text-[10px] text-[var(--color-muted-foreground)]">
              {ct.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
