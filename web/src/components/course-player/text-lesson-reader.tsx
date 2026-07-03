"use client";

import type { Lesson } from "@/lib/types/course";

export function TextLessonReader({
  content,
  alreadyComplete,
}: {
  content: Lesson["content"];
  alreadyComplete: boolean;
}) {
  const text = extractText(content);
  const hasText = Boolean(text && text.trim());

  if (!hasText) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
        Lesson content will be available soon.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <article
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
      >
        <div className="whitespace-pre-wrap text-left text-sm leading-relaxed text-[var(--color-foreground)]">
          {text}
        </div>
      </article>
      {!alreadyComplete && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Click <span className="font-medium">Complete &amp; Continue</span> below when you&apos;re done reading.
        </p>
      )}
    </div>
  );
}

// Supports the common `{ body: string }` shape used by seeded/authored text
// lessons, as well as a plain string.
function extractText(
  content: Lesson["content"],
): string | null {
  if (typeof content === "string") {
    return content;
  }
  if (content && typeof content === "object") {
    const value = content as Record<string, unknown>;
    if (typeof value.body === "string") {
      return value.body;
    }
  }
  return null;
}
