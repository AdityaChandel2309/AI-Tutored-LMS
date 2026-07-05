// ─── Typed course domain hooks ─────────────
// Centralized TanStack Query hooks for the course domain.
// All components share these — no duplicated query/mutation logic.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
} from "@/lib/api/client";
import type {
  Course,
  CourseSummary,
  Enrollment,
  ProgressSummary,
  CourseCategory,
  Video,
  VideoStreamResponse,
  VideoUploadResponse,
  ScormLaunchResponse,
  ScormPackage,
  ScormUploadResponse,
} from "@/lib/types/course";

// ── Query Keys ──────────────────────────────

export const courseKeys = {
  all: ["courses"] as const,
  detail: (id: string) =>
    ["course", id] as const,
  progress: (courseId: string) =>
    ["course-progress", courseId] as const,
  myEnrollments: ["my-courses"] as const,
  categories: ["categories"] as const,
  videoStream: (videoId: string) =>
    ["video-stream", videoId] as const,
  scormPackage: (packageId: string) =>
    ["scorm-package", packageId] as const,
  scormLaunch: (packageId: string) =>
    ["scorm-launch", packageId] as const,
};

// ── Queries ─────────────────────────────────

export function useCourses(status?: string | string[]) {
  const s = Array.isArray(status) ? status.join(',') : status;
  return useQuery<CourseSummary[]>({
    queryKey: [...courseKeys.all, s ?? ''],
    queryFn: () => apiGet(s ? `/courses?status=${encodeURIComponent(s)}` : '/courses'),
  });
}

export function useCourse(id: string) {
  return useQuery<Course>({
    queryKey: courseKeys.detail(id),
    queryFn: () => apiGet(`/courses/${id}`),
  });
}

export function useCourseProgress(
  courseId: string,
) {
  return useQuery<ProgressSummary>({
    queryKey: courseKeys.progress(courseId),
    queryFn: () =>
      apiGet(`/courses/${courseId}/progress`),
  });
}

export function useMyEnrollments() {
  return useQuery<Enrollment[]>({
    queryKey: courseKeys.myEnrollments,
    queryFn: () => apiGet("/my-courses"),
  });
}

export function useCategories() {
  return useQuery<CourseCategory[]>({
    queryKey: courseKeys.categories,
    queryFn: () => apiGet("/categories"),
  });
}

// ── Course Mutations ────────────────────────

// Generates a URL-safe slug from a title, with a short random suffix to avoid
// collisions within a tenant. The backend also validates uniqueness.
function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : `course-${suffix}`;
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      categoryId?: string;
    }) =>
      apiPost<Course>("/courses", {
        ...data,
        slug: slugifyTitle(data.title),
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.all,
      }),
  });
}

export function useUpdateCourse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string;
      categoryId?: string | null;
      visibility?: string;
    }) => apiPatch(`/courses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: courseKeys.detail(id),
      });
      qc.invalidateQueries({
        queryKey: courseKeys.all,
      });
    },
  });
}

export function useDeleteCourse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/courses/${id}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.all,
      }),
  });
}


export function useCourseWorkflow(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      action:
        | "submit-review"
        | "publish"
        | "archive"
        | "unpublish",
    ) => apiPost(`/courses/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: courseKeys.detail(id),
      });
      qc.invalidateQueries({
        queryKey: courseKeys.all,
      });
    },
  });
}

// ── Reorder Mutations ──────────────────────

export function useReorderModules(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiPost(`/courses/${courseId}/modules/reorder`, { orderedIds }),
    onMutate: async (orderedIds: string[]) => {
      await qc.cancelQueries({ queryKey: courseKeys.detail(courseId) });
      const prev = qc.getQueryData(courseKeys.detail(courseId));
      qc.setQueryData(courseKeys.detail(courseId), (old: any) => {
        if (!old?.modules) return old;
        const reordered = orderedIds
          .map((id, i) => {
            const mod = old.modules.find((m: any) => m.id === id);
            return mod ? { ...mod, order: i + 1 } : null;
          })
          .filter(Boolean);
        return { ...old, modules: reordered };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(courseKeys.detail(courseId), context.prev);
      }
    },
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

export function useReorderLessons(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, orderedIds }: { moduleId: string; orderedIds: string[] }) =>
      apiPost(`/modules/${moduleId}/lessons/reorder`, { orderedIds }),
    onMutate: async ({ moduleId, orderedIds }) => {
      await qc.cancelQueries({ queryKey: courseKeys.detail(courseId) });
      const prev = qc.getQueryData(courseKeys.detail(courseId));
      qc.setQueryData(courseKeys.detail(courseId), (old: any) => {
        if (!old?.modules) return old;
        return {
          ...old,
          modules: old.modules.map((mod: any) => {
            if (mod.id !== moduleId) return mod;
            const reordered = orderedIds
              .map((id, i) => {
                const lesson = mod.lessons.find((l: any) => l.id === id);
                return lesson ? { ...lesson, order: i + 1 } : null;
              })
              .filter(Boolean);
            return { ...mod, lessons: reordered };
          }),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(courseKeys.detail(courseId), context.prev);
      }
    },
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}


// ── Module Mutations ────────────────────────

export function useAddModule(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      apiPost(`/courses/${courseId}/modules`, {
        title,
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

export function useUpdateModule(
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleId,
      title,
    }: {
      moduleId: string;
      title: string;
    }) => apiPatch(`/modules/${moduleId}`, { title }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

export function useDeleteModule(
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) =>
      apiDelete(`/modules/${moduleId}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

// ── Lesson Mutations ────────────────────────

export function useAddLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleId,
      title,
      type,
    }: {
      moduleId: string;
      title: string;
      type: string;
    }) =>
      apiPost(`/modules/${moduleId}/lessons`, {
        title,
        type,
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

export function useDeleteLesson(
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) =>
      apiDelete(`/lessons/${lessonId}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

export function useUpdateLesson(
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      lessonId,
      ...data
    }: {
      lessonId: string;
      title?: string;
      type?: string;
      content?: Record<string, unknown> | null;
      duration?: number | null;
    }) => apiPatch(`/lessons/${lessonId}`, data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.detail(courseId),
      }),
  });
}

// ── Enrollment Mutations ────────────────────

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      apiPost(`/courses/${courseId}/enroll`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.myEnrollments,
      }),
  });
}

// ── Progress Mutations ──────────────────────

export function useUpdateProgress(
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      lessonId: string;
      state: "in_progress" | "completed";
      progress: number;
    }) =>
      apiPost(
        `/courses/${courseId}/progress`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.progress(courseId),
      }),
  });
}

// Completes a lesson via the xAPI-style statement endpoint. Used by the course
// player's automatic trackers (video 90%, text scroll-to-end, quiz pass). The
// payload mirrors a minimal xAPI statement; the backend ignores any client
// userId and writes progress for the authenticated session.
export function useCompleteLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { lessonId: string }) =>
      apiPost("/courses/complete-lesson", {
        courseId,
        lessonId: data.lessonId,
        status: "completed",
        timestamp: new Date().toISOString(),
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: courseKeys.progress(courseId),
      }),
  });
}

// ── Video Mutations ─────────────────────────

export function useRequestVideoUpload(
  courseId: string,
) {
  return useMutation({
    mutationFn: (data: {
      title: string;
      mimeType?: string;
      fileName?: string;
    }) =>
      apiPost<VideoUploadResponse>(
        `/courses/${courseId}/videos/upload-url`,
        data,
      ),
  });
}

export function useConfirmVideoUpload() {
  return useMutation({
    mutationFn: (data: {
      videoId: string;
      lessonId?: string;
    }) =>
      apiPatch<Video>(`/videos/${data.videoId}/confirm`, {
        lessonId: data.lessonId,
      }),
  });
}

export function useVideoStreamUrl(
  videoId: string | null,
) {
  return useQuery<VideoStreamResponse>({
    queryKey: courseKeys.videoStream(videoId ?? "missing"),
    queryFn: () => apiGet(`/videos/${videoId}/stream`),
    enabled: Boolean(videoId),
  });
}

// ── SCORM Mutations/Queries ─────────────────

export function useRequestScormUpload(
  courseId: string,
) {
  return useMutation({
    mutationFn: (data: {
      title?: string;
      mimeType?: string;
      fileName?: string;
    }) =>
      apiPost<ScormUploadResponse>(
        `/courses/${courseId}/scorm/upload-url`,
        data,
      ),
  });
}

export function useConfirmScormUpload() {
  return useMutation({
    mutationFn: (data: {
      packageId: string;
      lessonId?: string;
    }) =>
      apiPatch<ScormPackage>(
        `/scorm/${data.packageId}/confirm`,
        {
          lessonId: data.lessonId,
        },
      ),
  });
}

export function useScormPackage(
  packageId: string | null,
) {
  return useQuery<ScormPackage>({
    queryKey: courseKeys.scormPackage(packageId ?? "missing"),
    queryFn: () => apiGet(`/scorm/${packageId}`),
    enabled: Boolean(packageId),
  });
}

export function useScormLaunch(
  packageId: string | null,
) {
  return useQuery<ScormLaunchResponse>({
    queryKey: courseKeys.scormLaunch(packageId ?? "missing"),
    queryFn: () => apiGet(`/scorm/${packageId}/launch`),
    enabled: Boolean(packageId),
  });
}
