"use client";

import { useState } from "react";
import { FileText, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-[var(--radius)] px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "bg-[var(--color-muted)] text-[var(--color-foreground)]"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Sources:</p>
                  <ul className="space-y-1">
                    {dedupeSources(msg.sources).map((s) => (
                      <li key={s.id}>
                        <Link
                          href={`/dashboard/knowledge/${s.id}`}
                          className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                        >
                          <FileText className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {s.title}
                            {s.fileName ? ` · ${s.fileName}` : ""}
                          </span>
                        </Link>
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
