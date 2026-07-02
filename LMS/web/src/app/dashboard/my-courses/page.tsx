"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEnrollments } from "@/lib/api/courses";
import type { Enrollment } from "@/lib/types/course";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
        <span>Progress</span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background:
              pct === 100
                ? "var(--color-accent)"
                : "var(--color-primary)",
          }}
        />
      </div>
    </div>
  );
}

function MyCoursesSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="space-y-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
  );
}

export default function MyCoursesPage() {
  const router = useRouter();
  const enrollmentsQuery = useMyEnrollments();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            badge={<Badge variant="warning">Learning</Badge>}
            title="My Courses"
            description="Track your enrolled courses and learning progress."
            actions={
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard/courses")}
                >
                  Browse Catalog
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard")}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Dashboard
                </Button>
              </div>
            }
          />
        </Card>

        <AsyncBoundary
          query={enrollmentsQuery}
          skeleton={<MyCoursesSkeleton />}
          errorMessage="Failed to load your courses"
          empty={
            <Card className="p-8">
              <EmptyState
                icon={GraduationCap}
                title="You have not enrolled in any courses yet"
                description="Browse the catalog to find a course and start learning."
                action={
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push("/dashboard/courses")
                    }
                  >
                    Browse Catalog
                  </Button>
                }
              />
            </Card>
          }
        >
          {(enrollments: Enrollment[]) => (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <Card
                  key={enrollment.id}
                  className="group flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_72px_-40px_rgba(15,23,42,0.45)]"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold leading-tight tracking-tight">
                        {enrollment.course.title}
                      </h3>
                      {enrollment.completedAt ? (
                        <Badge variant="success">Completed</Badge>
                      ) : (
                        <Badge variant="warning">In Progress</Badge>
                      )}
                    </div>

                    {enrollment.course.category && (
                      <span className="inline-block rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                        {enrollment.course.category.name}
                      </span>
                    )}

                    {enrollment.course.description && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                        {enrollment.course.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <ProgressBar value={enrollment.progress ?? 0} />

                    <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                      <span>
                        {enrollment.course._count.modules} modules
                      </span>
                      <span>
                        Enrolled{" "}
                        {new Date(
                          enrollment.createdAt,
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        router.push(
                          `/dashboard/courses/${enrollment.courseId}`,
                        )
                      }
                    >
                      {enrollment.completedAt
                        ? "Review Course"
                        : "Continue Learning"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}
