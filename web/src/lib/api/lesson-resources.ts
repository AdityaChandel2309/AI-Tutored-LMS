import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import { apiDelete, apiGet, apiPost } from "@/lib/api/client";

export interface LessonResource {
  id: string;
  lessonId: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface ResourceUploadTicket {
  resourceId: string;
  uploadUrl: string;
  objectKey: string;
  maxSizeBytes: number;
  expiresAt: string;
}

export const resourceKeys = {
  list: (lessonId: string) => ["lesson-resources", lessonId] as const,
};

export function useLessonResources(lessonId: string, enabled = true) {
  return useQuery<LessonResource[]>({
    queryKey: resourceKeys.list(lessonId),
    queryFn: () => apiGet(`/lessons/${lessonId}/resources`),
    enabled: enabled && !!lessonId,
  });
}

export function useRequestResourceUpload(lessonId: string) {
  return useMutation<
    ResourceUploadTicket,
    Error,
    { fileName: string; mimeType: string; label?: string }
  >({
    mutationFn: (body) =>
      apiPost(`/lessons/${lessonId}/resources/upload-url`, body),
  });
}

export function useConfirmResourceUpload(lessonId: string) {
  const qc = useQueryClient();
  return useMutation<
    LessonResource,
    Error,
    {
      resourceId: string;
      objectKey: string;
      fileName: string;
      mimeType: string;
      label?: string;
    }
  >({
    mutationFn: (body) =>
      apiPost(`/lessons/${lessonId}/resources/confirm`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: resourceKeys.list(lessonId) }),
  });
}

export function useDeleteResource(lessonId: string) {
  const qc = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, string>({
    mutationFn: (id) => apiDelete(`/resources/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: resourceKeys.list(lessonId) }),
  });
}

export async function fetchResourceDownloadUrl(id: string): Promise<{
  url: string;
  fileName: string;
}> {
  return { url: getApiUrl(`/resources/${id}/file`), fileName: "resource" };
}