"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Send, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDocument, getDownloadUrl } from "@/lib/api/knowledge";
import type { Document } from "@/lib/types/knowledge";

export interface Message {
  role: string;
  content: string;
  sources?: { id: string; title: string; type?: string; fileName?: string }[];
}

export function ChatPanel({ messages, onSend, loading, placeholder }: {
  messages: Message[];
  onSend: (text: string) => void;
  loading: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  async function copyMessage(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500);
    } catch {
      // ignore
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`group relative max-w-[80%] rounded-[var(--radius)] px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "bg-[var(--color-muted)] text-[var(--color-foreground)]"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => copyMessage(msg.content, i)}
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] opacity-0 shadow-[var(--shadow-soft)] transition-opacity hover:text-[var(--color-primary)] group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={copiedIdx === i ? "Copied" : "Copy answer"}
                  title={copiedIdx === i ? "Copied" : "Copy answer"}
                >
                  {copiedIdx === i ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden />
                  )}
                </button>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Sources:</p>
                  <ul className="space-y-1">
                    {dedupeSources(msg.sources).map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setPreviewId(s.id)}
                          className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {s.title}
                            {s.fileName ? ` · ${s.fileName}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-muted)] rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">Thinking...</div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)] p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder || "Type a message..."}
          className="flex-1"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={!input.trim() || loading}>
          <Send className="h-4 w-4" aria-hidden />
          Send
        </Button>
      </form>
      {previewId && (
        <CitationPreview id={previewId} onClose={() => setPreviewId(null)} />
      )}
    </div>
  );
}

// Retrieval returns one entry per chunk, so the same document can appear
// multiple times. Collapse to unique document IDs, keeping first occurrence
// order (retrieval already ranks by relevance).
function dedupeSources<T extends { id: string }>(sources: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of sources) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
  }
  return out;
}

// Slide-in preview panel for a citation. Fetches document metadata on demand
// so we don't pull details for citations the user never clicks on. Escape
// closes the panel to match the standard dialog UX.
function CitationPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    getDocument(id)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function download() {
    try {
      const { url } = await getDownloadUrl(id);
      window.open(url, "_blank");
    } catch {
      // ignore
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-[color:color-mix(in_oklch,var(--color-foreground)_25%,transparent)]">
      <button
        type="button"
        aria-label="Close preview"
        className="flex-1"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-sm flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
            Source preview
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {error && <p className="text-[var(--color-danger)]">{error}</p>}
          {!error && !doc && (
            <p className="text-[var(--color-muted-foreground)]">Loading…</p>
          )}
          {doc && (
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold">{doc.title}</h3>
                {doc.description && (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    {doc.description}
                  </p>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card-muted)] p-3 text-xs">
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Type</dt>
                  <dd className="font-medium">{doc.type}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Version</dt>
                  <dd className="font-medium">v{doc.version}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Category</dt>
                  <dd className="font-medium">{doc.category?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted-foreground)]">Size</dt>
                  <dd className="font-medium">{(doc.fileSize / 1024).toFixed(0)} KB</dd>
                </div>
              </dl>
              {doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {doc.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="grid grid-cols-2 gap-2 border-t border-[var(--color-border)] p-3">
          <Button type="button" size="sm" variant="outline" onClick={download} disabled={!doc}>
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
          <Button asChild size="sm">
            <Link href={`/dashboard/knowledge/${id}`}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open
            </Link>
          </Button>
        </footer>
      </aside>
    </div>
  );
}
