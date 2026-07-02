import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import type {
  ActivityTimelineResponse,
  CompletionCountResponse,
  PassRateResponse,
  EnrollmentCountResponse,
  CertificateCountResponse,
} from "@/lib/types/analytics";

export const analyticsKeys = {
  activity: (params?: { take?: number; skip?: number; type?: string }) =>
    ["my-activity", params] as const,
  completions: ["reports-completions"] as const,
  passRates: ["reports-pass-rates"] as const,
  enrollments: ["reports-enrollments"] as const,
  certificates: ["reports-certificates"] as const,
};

export function useMyActivity(params?: {
  take?: number;
  skip?: number;
  type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.take) searchParams.set("take", String(params.take));
  if (params?.skip) searchParams.set("skip", String(params.skip));
  if (params?.type) searchParams.set("type", params.type);
  const qs = searchParams.toString();

  return useQuery<ActivityTimelineResponse>({
    queryKey: analyticsKeys.activity(params),
    queryFn: () => apiGet(`/my/activity${qs ? `?${qs}` : ""}`),
  });
}

export function useReportingCompletions() {
  return useQuery<CompletionCountResponse>({
    queryKey: analyticsKeys.completions,
    queryFn: () => apiGet("/analytics/reports/completions"),
  });
}

export function useReportingPassRates() {
  return useQuery<PassRateResponse>({
    queryKey: analyticsKeys.passRates,
    queryFn: () => apiGet("/analytics/reports/pass-rates"),
  });
}

export function useReportingEnrollments() {
  return useQuery<EnrollmentCountResponse>({
    queryKey: analyticsKeys.enrollments,
    queryFn: () => apiGet("/analytics/reports/enrollments"),
  });
}

export function useReportingCertificates() {
  return useQuery<CertificateCountResponse>({
    queryKey: analyticsKeys.certificates,
    queryFn: () => apiGet("/analytics/reports/certificates"),
  });
}

export interface DashboardSummary {
  totalCourses: number;
  activeCourses: number;
  totalUsers: number;
  totalEnrollments: number;
  completions: number;
  certificates: number;
  completionRate: number;
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiGet("/analytics/dashboard-summary"),
  });
}
