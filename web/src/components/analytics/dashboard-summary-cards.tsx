"use client";

import { BookOpen, Users, GraduationCap, Award } from "lucide-react";
import { useDashboardSummary } from "@/lib/api/analytics";
import { Stat } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSummaryCards() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat
        label="Active Courses"
        value={String(data.activeCourses)}
        hint={`${data.totalCourses} total`}
        icon={BookOpen}
        tone="primary"
      />
      <Stat
        label="Users"
        value={String(data.totalUsers)}
        hint="Active accounts"
        icon={Users}
        tone="info"
      />
      <Stat
        label="Enrollments"
        value={String(data.totalEnrollments)}
        hint={`${data.completions} completed`}
        icon={GraduationCap}
        tone="accent"
      />
      <Stat
        label="Completion Rate"
        value={`${data.completionRate}%`}
        hint={`${data.certificates} certificates`}
        icon={Award}
        tone="success"
      />
    </div>
  );
}
