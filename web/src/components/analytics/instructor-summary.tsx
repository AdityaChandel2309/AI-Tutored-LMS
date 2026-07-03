"use client";

import {
  useReportingCompletions,
  useReportingPassRates,
  useReportingEnrollments,
  useReportingCertificates,
} from "@/lib/api/analytics";
import { GraduationCap, CheckCircle2, TrendingUp, Award } from "lucide-react";
import { Stat } from "@/components/ui/stat";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";

export function InstructorSummary() {
  const completions = useReportingCompletions();
  const passRates = useReportingPassRates();
  const enrollments = useReportingEnrollments();
  const certificates = useReportingCertificates();

  const isLoading =
    completions.isLoading ||
    passRates.isLoading ||
    enrollments.isLoading ||
    certificates.isLoading;

  const hasError =
    completions.error || passRates.error || enrollments.error || certificates.error;

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (hasError) return <Notice variant="danger">Failed to load analytics data.</Notice>;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat
        label="Total Enrollments"
        value={enrollments.data?.count ?? 0}
        hint="All-time enrollment count"
        icon={GraduationCap}
        tone="primary"
      />
      <Stat
        label="Course Completions"
        value={completions.data?.count ?? 0}
        hint="Courses fully completed"
        icon={CheckCircle2}
        tone="success"
      />
      <Stat
        label="Pass Rate"
        value={`${passRates.data?.passRate ?? 0}%`}
        hint={`${passRates.data?.passed ?? 0} passed / ${passRates.data?.attempted ?? 0} attempted`}
        icon={TrendingUp}
        tone="info"
      />
      <Stat
        label="Certificates Issued"
        value={certificates.data?.count ?? 0}
        hint="Total certificates earned"
        icon={Award}
        tone="accent"
      />
    </div>
  );
}
