"use client";

import { Download, FileText } from "lucide-react";
import {
  fetchResourceDownloadUrl,
  useLessonResources,
} from "@/lib/api/lesson-resources";

function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function LessonResources({ lessonId }: { lessonId: string }) {
  const { data: resources = [], isLoading } = useLessonResources(lessonId);

  if (isLoading || resources.length === 0) return null;

  async function download(id: string) {
    try {
      const { url } = await fetchResourceDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Downloadable resources
      </p>
      <ul className="space-y-1.5">
        {resources.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => download(r.id)}
              className="flex w-full items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-muted)]"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                  {r.fileName} · {formatBytes(r.sizeBytes)}
                </p>
              </div>
              <Download className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}