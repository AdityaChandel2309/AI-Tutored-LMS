"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { Lesson } from "@/lib/types/course";

// How long (ms) the learner must dwell at the end of the article before the
// lesson counts as read. Prevents an instant scroll-to-bottom from completing
// it, while staying short enough to feel automatic.
const DWELL_MS = 3000;
// Consider the learner "at the end" once the article bottom is within this many
// pixels of the viewport bottom (mirrors a ~50px threshold).
const BOTTOM_THRESHOLD_PX = 80;

export function TextLessonReader({
  content,
  alreadyComplete,
  onComplete,
}: {
  content: Lesson["content"];
  alreadyComplete: boolean;
  onComplete?: () => void;
}) {
  const articleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard so completion only ever fires once per mount.
  const firedRef = useRef(false);
  // Keep the latest onComplete without making it an effect dependency, so the
  // scroll/observer listeners are NOT torn down on every parent re-render
  // (which would reset the dwell timer and prevent completion).
  const onCompleteRef = useRef(onComplete);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const text = extractText(content);
  const hasText = Boolean(text && text.trim());

  useEffect(() => {
    // Reset the one-shot guard whenever the lesson content changes.
    firedRef.current = false;
  }, [text]);

  useEffect(() => {
    if (!hasText || alreadyComplete) {
      return;
    }

    function clearTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function fireComplete() {
      if (firedRef.current) return;
      firedRef.current = true;
      clearTimer();
      onCompleteRef.current?.();
    }

    // Returns true when the learner has reached the end of the article, OR the
    // article is short enough that it fits on screen without scrolling.
    function isAtEnd(): boolean {
      const el = articleRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const viewportH =
        window.innerHeight || document.documentElement.clientHeight;
      // Bottom of the article is at/above the viewport bottom (+ threshold).
      return rect.bottom - BOTTOM_THRESHOLD_PX <= viewportH;
    }

    function evaluate() {
      if (firedRef.current) return;
      if (isAtEnd()) {
        if (!atBottom) setAtBottom(true);
        // Arm the dwell timer once; it fires completion after DWELL_MS.
        if (!timerRef.current) {
          timerRef.current = setTimeout(fireComplete, DWELL_MS);
        }
      } else {
        if (atBottom) setAtBottom(false);
        clearTimer();
      }
    }

    // Evaluate now (covers short content already fully visible) and on scroll
    // / resize. A small initial delay lets layout settle after navigation.
    const initial = setTimeout(evaluate, 150);
    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);

    return () => {
      clearTimeout(initial);
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
      clearTimer();
    };
    // Intentionally depends only on stable values — NOT on onComplete — so the
    // listeners and dwell timer survive parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasText, alreadyComplete, text]);

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
        ref={articleRef}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
      >
        <div className="whitespace-pre-wrap text-left text-sm leading-relaxed text-[var(--color-foreground)]">
          {text}
        </div>
      </article>

      {!alreadyComplete && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {atBottom
            ? "Finishing up — keep this lesson open a moment to complete it…"
            : "Scroll to the end to complete this lesson automatically."}
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
