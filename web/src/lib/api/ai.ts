import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client";

export interface ChatMessage {
  id?: string;
  role: string;
  content: string;
  createdAt?: string;
  sourceDocIds?: string[];
}

export interface AssistantResponse {
  role: string;
  content: string;
  sources?: { id: string; title: string; type: string; fileName: string }[];
}

// NOTE: The Next.js API route handlers (under src/app/api/*) relay the backend's
// `{ data }` envelope already UNWRAPPED via `relayBackendDataResponse`, and they
// expose a single route per resource (POST + GET on the same path). So these
// functions hit the bare route (e.g. `/ai-tutor`, not `/ai-tutor/chat`) and read
// the unwrapped payload directly (e.g. `AssistantResponse`, NOT `{ data: ... }`).

export function sendTutorMessage(data: { message: string; courseId: string; lessonId?: string }) {
  return apiPost<AssistantResponse>("/ai-tutor", data);
}

export function getTutorHistory(courseId: string) {
  return apiGet<ChatMessage[]>(`/ai-tutor?courseId=${courseId}`);
}

export function askKnowledgeAssistant(data: { question: string; categoryId?: string }) {
  return apiPost<AssistantResponse>("/knowledge-assistant", data);
}

export function getAssistantHistory() {
  return apiGet<ChatMessage[]>("/knowledge-assistant");
}

// ── Query Keys ──────────────────────────────

export const aiKeys = {
  assistantHistory: ["knowledge-assistant", "history"] as const,
};

// ── Queries ─────────────────────────────────

// Loads prior Knowledge Assistant messages via `GET /api/knowledge-assistant`
// (relayed to the backend `/knowledge-assistant/history`). The response is the
// unwrapped `ChatMessage[]`, used to seed the chat transcript.
export function useAssistantHistory() {
  return useQuery<ChatMessage[]>({
    queryKey: aiKeys.assistantHistory,
    queryFn: () => getAssistantHistory(),
  });
}
