// ─── Typed assessment domain hooks ─────────
// Centralized TanStack Query hooks for the assessment domain.

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
  Assessment,
  Question,
  AssessmentAttempt,
  AttemptSummary,
} from "@/lib/types/course";
import { courseKeys } from "@/lib/api/courses";

// ── Query Keys ──────────────────────────────

export const assessmentKeys = {
  forLesson: (lessonId: string) =>
    ["assessment", lessonId] as const,
  attempts: (assessmentId: string) =>
    ["assessment-attempts", assessmentId] as const,
  attempt: (attemptId: string) =>
    ["attempt", attemptId] as const,
};

// ── Assessment Queries ──────────────────────

export function useAssessment(lessonId: string | null) {
  return useQuery<Assessment>({
    queryKey: assessmentKeys.forLesson(lessonId ?? "none"),
    queryFn: () =>
      apiGet(`/lessons/${lessonId}/assessment`),
    enabled: Boolean(lessonId),
  });
}

export function useMyAttempts(assessmentId: string | null) {
  return useQuery<AttemptSummary[]>({
    queryKey: assessmentKeys.attempts(assessmentId ?? "none"),
    queryFn: () =>
      apiGet(`/assessments/${assessmentId}/attempts`),
    enabled: Boolean(assessmentId),
  });
}

export function useAttemptResult(attemptId: string | null) {
  return useQuery<AssessmentAttempt>({
    queryKey: assessmentKeys.attempt(attemptId ?? "none"),
    queryFn: () => apiGet(`/attempts/${attemptId}`),
    enabled: Boolean(attemptId),
  });
}

// ── Assessment Mutations ────────────────────

export function useCreateAssessment(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      passingScore?: number;
      maxAttempts?: number | null;
      timeLimitSec?: number | null;
    }) =>
      apiPost<Assessment>(
        `/lessons/${lessonId}/assessment`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

export function useUpdateAssessment(
  assessmentId: string,
  lessonId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string | null;
      passingScore?: number;
      maxAttempts?: number | null;
      timeLimitSec?: number | null;
    }) =>
      apiPatch(`/assessments/${assessmentId}`, data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

export function useDeleteAssessment(
  assessmentId: string,
  lessonId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiDelete(`/assessments/${assessmentId}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

// ── Question Mutations ──────────────────────

export function useAddQuestion(
  assessmentId: string,
  lessonId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: string;
      text: string;
      explanation?: string;
      points?: number;
      order: number;
      options: {
        text: string;
        isCorrect: boolean;
        order: number;
      }[];
    }) =>
      apiPost<Question>(
        `/assessments/${assessmentId}/questions`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

export function useUpdateQuestion(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      ...data
    }: {
      questionId: string;
      type?: string;
      text?: string;
      explanation?: string | null;
      points?: number;
      order?: number;
      options?: {
        text: string;
        isCorrect: boolean;
        order: number;
      }[];
    }) => apiPatch(`/questions/${questionId}`, data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

export function useDeleteQuestion(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      apiDelete(`/questions/${questionId}`),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.forLesson(lessonId),
      }),
  });
}

// ── Attempt Mutations ───────────────────────

export function useStartAttempt(assessmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<AssessmentAttempt>(
        `/assessments/${assessmentId}/attempts`,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: assessmentKeys.attempts(assessmentId),
      }),
  });
}

export function useSubmitAttempt(
  attemptId: string,
  assessmentId: string,
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      answers: {
        questionId: string;
        selectedOptionIds: string[];
      }[];
    }) =>
      apiPost<AssessmentAttempt>(
        `/attempts/${attemptId}/submit`,
        data,
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: assessmentKeys.attempts(assessmentId),
      });
      qc.invalidateQueries({
        queryKey: assessmentKeys.attempt(attemptId),
      });
      qc.invalidateQueries({
        queryKey: courseKeys.progress(courseId),
      });
    },
  });
}
