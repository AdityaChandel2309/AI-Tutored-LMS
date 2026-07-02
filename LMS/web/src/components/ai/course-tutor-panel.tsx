"use client";

import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { ChatPanel, type Message } from "@/components/ai/chat-panel";
import {
  getTutorHistory,
  sendTutorMessage,
} from "@/lib/api/ai";

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi! I'm your AI tutor for this course. Ask me anything about the material — concepts, examples, or where to find something in a lesson. I'm available 24/7.",
};

/**
 * Course-contextual AI tutor.
 *
 * Renders a floating launcher that opens a chat panel. Messages are sent to
 * the enrollment-guarded `/ai-tutor` endpoint with the current course (and the
 * active lesson, when known) so the assistant can ground its answers in the
 * lesson the learner is viewing. History is loaded per-course on open.
 */
export function CourseTutorPanel({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [loading, setLoading] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);

  // Lazy-load prior conversation the first time the panel is opened.
  useEffect(() => {
    if (!open || loadedHistory) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await getTutorHistory(courseId);
        if (cancelled) return;
        if (history.length > 0) {
          setMessages(
            history.map((m) => ({ role: m.role, content: m.content })),
          );
        }
      } catch {
        // Keep the welcome message if history can't be loaded.
      } finally {
        if (!cancelled) setLoadedHistory(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loadedHistory, courseId]);

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const data = await sendTutorMessage({
        message: text,
        courseId,
        lessonId: lessonId ?? undefined,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Sorry, I couldn't respond right now. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: message },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI tutor"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-primary-foreground)] shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
      >
        <Bot className="h-5 w-5" aria-hidden />
        Ask AI Tutor
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-primary-soft)] px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
          <Bot className="h-4 w-4" aria-hidden />
          AI Tutor
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close AI tutor"
          className="rounded-[calc(var(--radius)-10px)] p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          loading={loading}
          placeholder="Ask about this course…"
        />
      </div>
    </div>
  );
}
