import {
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, apiFetch } from "./client";
import type { Document, DocumentCategory, DocumentListResponse } from "../types/knowledge";

// NOTE: The Next.js API route handlers (src/app/api/*) relay the backend's
// `{ data }` envelope already UNWRAPPED via `relayBackendDataResponse`. So every
// function here reads the bare payload directly (e.g. `DocumentListResponse`,
// NOT `{ data: DocumentListResponse }`). Unwrapping a second time was the bug
// that made the Knowledge Base render empty.

export interface DocumentListParams {
  categoryId?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
}

function documentsQueryString(params?: DocumentListParams) {
  const query = new URLSearchParams();
  if (params?.categoryId) query.set("categoryId", params.categoryId);
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function getDocuments(params?: DocumentListParams) {
  return apiGet<DocumentListResponse>(`/documents${documentsQueryString(params)}`);
}

export function getDocument(id: string) {
  return apiGet<Document>(`/documents/${id}`);
}

export function getDownloadUrl(id: string) {
  return apiGet<{ url: string; fileName: string }>(`/documents/${id}/download`);
}

export async function uploadDocument(file: File, metadata: { title: string; description?: string; type?: string; categoryId?: string; tags?: string[]; status?: string }) {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([k, v]) => {
    if (v !== undefined) formData.append(k, Array.isArray(v) ? JSON.stringify(v) : v);
  });
  return apiFetch<Document>("/documents", { method: "POST", body: formData });
}

export function updateDocument(id: string, data: Record<string, unknown>) {
  return apiPatch<Document>(`/documents/${id}`, data);
}

export async function uploadVersion(id: string, file: File, changeNote?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (changeNote) formData.append("changeNote", changeNote);
  return apiFetch<Document>(`/documents/${id}/versions`, { method: "POST", body: formData });
}

export function deleteDocument(id: string) {
  return apiDelete(`/documents/${id}`);
}

export function getDocumentCategories() {
  return apiGet<DocumentCategory[]>("/document-categories");
}

export function createDocumentCategory(data: { name: string; slug: string; parentId?: string; description?: string }) {
  return apiPost<DocumentCategory>("/document-categories", data);
}

export function deleteDocumentCategory(id: string) {
  return apiDelete(`/document-categories/${id}`);
}

// ── Query Keys ──────────────────────────────

export const documentKeys = {
  all: ["documents"] as const,
  list: (params?: DocumentListParams) =>
    [
      "documents",
      {
        categoryId: params?.categoryId ?? null,
        type: params?.type ?? null,
        status: params?.status ?? null,
        search: params?.search ?? null,
        page: params?.page ?? 1,
      },
    ] as const,
  categories: ["document-categories"] as const,
};

// ── Queries ─────────────────────────────────

// Lists published documents via `GET /api/documents`. The response is the
// unwrapped `DocumentListResponse`, so the page reads `items`/`total` directly.
// `keepPreviousData` avoids a loading flash while filters/pagination change.
export function useDocuments(params?: DocumentListParams) {
  return useQuery<DocumentListResponse>({
    queryKey: documentKeys.list(params),
    queryFn: () => getDocuments(params),
    placeholderData: keepPreviousData,
  });
}

// Lists document categories via `GET /api/document-categories`. The response is
// the unwrapped `DocumentCategory[]` for the filter dropdown.
export function useDocumentCategories() {
  return useQuery<DocumentCategory[]>({
    queryKey: documentKeys.categories,
    queryFn: () => getDocumentCategories(),
  });
}
