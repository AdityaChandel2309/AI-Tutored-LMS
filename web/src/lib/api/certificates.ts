// ─── Typed certificate domain hooks ────────
// Centralized TanStack Query hooks for the certificate domain.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apiGet,
  apiPost,
  apiPatch,
} from "@/lib/api/client";
import type {
  CertificateTemplate,
  IssuedCertificate,
  CertificatePdfResponse,
} from "@/lib/types/course";

// ── Query Keys ──────────────────────────────

export const certificateKeys = {
  template: (courseId: string) =>
    ["certificate-template", courseId] as const,
  myCertificates: ["my-certificates"] as const,
  pdf: (certId: string) =>
    ["certificate-pdf", certId] as const,
};

// ── Template Queries ────────────────────────

export function useCertificateTemplate(courseId: string | null) {
  return useQuery<CertificateTemplate>({
    queryKey: certificateKeys.template(courseId ?? "none"),
    queryFn: () =>
      apiGet(`/courses/${courseId}/certificate-template`),
    enabled: Boolean(courseId),
    retry: false,
  });
}

// ── Template Mutations ──────────────────────

export function useCreateCertificateTemplate(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
    }) =>
      apiPost<CertificateTemplate>(
        `/courses/${courseId}/certificate-template`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: certificateKeys.template(courseId),
      }),
  });
}

export function useUpdateCertificateTemplate(
  templateId: string,
  courseId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string;
      isActive?: boolean;
    }) =>
      apiPatch(`/certificate-templates/${templateId}`, data),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: certificateKeys.template(courseId),
      }),
  });
}

// ── Issuance Mutations ──────────────────────

export function useIssueCertificate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { enrollmentId: string }) =>
      apiPost<IssuedCertificate>(
        `/certificate-templates/${templateId}/issue`,
        data,
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: certificateKeys.myCertificates,
      }),
  });
}

// ── Learner Queries ─────────────────────────

export function useMyCertificates() {
  return useQuery<IssuedCertificate[]>({
    queryKey: certificateKeys.myCertificates,
    queryFn: () => apiGet("/my/certificates"),
  });
}

export function useCertificatePdf(certId: string | null) {
  return useQuery<CertificatePdfResponse>({
    queryKey: certificateKeys.pdf(certId ?? "none"),
    queryFn: () =>
      apiGet(`/certificates/${certId}/pdf`),
    enabled: Boolean(certId),
  });
}
