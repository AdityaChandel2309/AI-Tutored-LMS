"use client";

import { useState } from "react";
import { ChatPanel, type Message } from "@/components/ai/chat-panel";
import {
  askKnowledgeAssistant,
  useAssistantHistory,
  type ChatMessage,
} from "@/lib/api/ai";
import { useMe } from "@/lib/api/me";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { useSessionExpiryRedirect } from "@/lib/api/use-session-expiry-redirect";

// Interactive chat shell, seeded from the loaded history. Kept as its own
// component so the message transcript lives in local state (new messages are
// appended) while the history fetch stays in react-query. The AI message
// submit side effect (`askKnowledgeAssistant`) is preserved exactly.
function AssistantChat({ initialHistory, isAdmin }: { initialHistory: ChatMessage[]; isAdmin: boolean }) {
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.map((m) => ({ role: m.role, content: m.content })),
  );
  const [loading, setLoading] = useState(false);

  async function handleSend(text: string) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const data = await askKnowledgeAssistant({ question: text });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content, sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[520px] flex-1 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
      <ChatPanel
        messages={messages}
        onSend={handleSend}
        loading={loading}
        placeholder={
          isAdmin
            ? "Ask about policies, projects, employees, courses..."
            : "Ask about company policies, procedures..."
        }
      />
    </div>
  );
}

export default function AssistantPage() {
  const history = useAssistantHistory();
  const me = useMe();
  useSessionExpiryRedirect(history.error);

  const roles = me.data?.roles ?? [];
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_50%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            title="Enterprise Knowledge Assistant"
            description={
              isAdmin
                ? "Ask about company policies and SOPs, plus live data like ongoing and completed projects, employees, courses, and organization metrics."
                : "Ask questions about company policies, SOPs, procedures, and operational guidelines."
            }
          />
        </Card>

        {history.isError && (
          <Notice variant="danger">
            We could not load your assistant history. You can still start a new conversation.
          </Notice>
        )}

        <AssistantChat initialHistory={history.data ?? []} isAdmin={isAdmin} />
      </div>
    </main>
  );
}
