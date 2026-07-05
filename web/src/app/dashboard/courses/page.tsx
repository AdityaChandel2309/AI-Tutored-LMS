"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Pencil,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourses, useEnroll, useMyEnrollments } from "@/lib/api/courses";
import { useMe } from "@/lib/api/me";
import { ApiError } from "@/lib/api/client";
import { Notice } from "@/components/ui/notice";
import type { CourseSummary } from "@/lib/types/course";

const statusVariant = (
  status: string,
): "success" | "warning" | "neutral" => {
  if (status === "published") return "success";
  if (status === "draft" || status === "review")
    return "warning";
  return "neutral";
};

function CatalogSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="space-y-4">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
  );
}

export default function CourseCatalogPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    () => new Set(["published"]),
  );
  const coursesQuery = useCourses(Array.from(statusFilter));
  const enroll = useEnroll();
  const { data: myEnrollments } = useMyEnrollments();
  const { data: me } = useMe();
  const [search, setSearch] = useState("");
  const [banner, setBanner] = useState<{
    variant: "success" | "warning" | "danger";
    message: string;
  } | null>(null);

  const isInstructor = me?.roles?.includes("instructor") ?? false;
  const isSuperAdmin = me?.roles?.includes('super_admin') ?? false;
  const isAdmin = me?.roles?.includes('admin') ?? false;
  const canAuthor = isInstructor; // Only instructors create courses

  // Chip list depends on role:
  //  - Instructors: Published + Draft + Review (their own drafts/reviews)
  //  - Super-admin: Published + Review (all pending review) + Archived
  //  - Admin:       Published + Archived
  //  - Learner:     Published only
  const chipStatuses: string[] = (() => {
    const set = new Set<string>(["published"]);
    if (isInstructor) {
      set.add("draft");
      set.add("review");
    }
    if (isSuperAdmin) set.add("review");
    if (isSuperAdmin || isAdmin || isInstructor) set.add("archived");
    return Array.from(set);
  })();

  function toggleStatus(status: string) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      // Never allow an empty selection — snap back to published.
      if (next.size === 0) next.add("published");
      return next;
    });
  }

  const enrolledCourseIds = new Set(
    (myEnrollments ?? []).map((e) => e.courseId),
  );

  function handleEnroll(courseId: string) {
    setBanner(null);
    enroll.mutate(courseId, {
      onSuccess: () => router.push("/dashboard/my-courses"),
      onError: (err) => {
        // Already enrolled (409): not really an error — just take the learner
        // to where the course lives instead of showing a scary message.
        if (err instanceof ApiError && err.status === 409) {
          setBanner({
            variant: "warning",
            message:
              "You're already enrolled in this course. Taking you to My Courses…",
          });
          setTimeout(
            () => router.push("/dashboard/my-courses"),
            900,
          );
          return;
        }
        setBanner({
          variant: "danger",
          message:
            err instanceof Error
              ? err.message
              : "Enrollment failed. Please try again.",
        });
      },
    });
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            badge={<Badge variant="success">Catalog</Badge>}
            title="Course Catalog"
            description="Browse available courses and enroll in published programs."
            actions={
              <div className="flex gap-2">
                {canAuthor && (
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push("/dashboard/courses/new")
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Create Course
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push("/dashboard/my-courses")
                  }
                >
                  My Courses
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

        {banner && (
          <Notice variant={banner.variant}>
            {banner.message}
          </Notice>
        )}

        <AsyncBoundary
          query={coursesQuery}
          skeleton={<CatalogSkeleton />}
          errorMessage="Failed to load courses"
          empty={
            <Card className="p-8">
              <EmptyState
                icon={BookOpen}
                title="No courses available yet"
                description="Published courses will appear here once they are created."
              />
            </Card>
          }
        >
          {(courses: CourseSummary[]) => {
            const q = search.toLowerCase().trim();
            const filtered = !q
              ? courses
              : courses.filter(
                  (c) =>
                    c.title.toLowerCase().includes(q) ||
                    c.description?.toLowerCase().includes(q) ||
                    c.category?.name.toLowerCase().includes(q),
                );

            return (
              <div className="space-y-6">
                {/* Search */}
                <div className="relative">
                  <Input
                    placeholder="Search courses by title, description, or category…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 pl-11 text-base"
                  />
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
                  />
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-2">
                  {chipStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${statusFilter.has(status)
                        ? 'bg-[var(--color-primary)] text-white shadow-md'
                        : 'bg-[var(--color-card)] text-[var(--color-muted-foreground)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-foreground)]'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                  <Card className="p-8">
                    <EmptyState
                      icon={Search}
                      title="No courses match your search"
                      description="Try a different title, description, or category."
                    />
                  </Card>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((course) => (
                      <Card
                        key={course.id}
                        className="group flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_72px_-40px_rgba(15,23,42,0.45)]"
                      >
                        {/* Top */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg font-semibold leading-tight tracking-tight">
                              {course.title}
                            </h3>
                            <Badge
                              variant={statusVariant(
                                course.status,
                              )}
                            >
                              {course.status}
                            </Badge>
                          </div>

                          {course.category && (
                            <span className="inline-block rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                              {course.category.name}
                            </span>
                          )}

                          {course.description && (
                            <p className="line-clamp-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                              {course.description}
                            </p>
                          )}
                        </div>

                        {/* Stats + Action */}
                        <div className="mt-5 space-y-3">
                          <div className="flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
                            <span className="flex items-center gap-1">
                              <BookOpen
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                              {course._count.modules} modules
                            </span>
                            <span className="flex items-center gap-1">
                              <Users
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                              {course._count.enrollments} enrolled
                            </span>
                          </div>

                          {course.status === "published" &&
                            (enrolledCourseIds.has(course.id) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/courses/${course.id}`,
                                  )
                                }
                              >
                                Go to Course
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full"
                                disabled={
                                  enroll.isPending &&
                                  enroll.variables === course.id
                                }
                                onClick={() =>
                                  handleEnroll(course.id)
                                }
                              >
                                {enroll.isPending &&
                                enroll.variables === course.id
                                  ? "Enrolling…"
                                  : "Enroll Now"}
                              </Button>
                            ))}

                          {canAuthor && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full"
                              onClick={() =>
                                router.push(
                                  `/dashboard/courses/${course.id}/edit`,
                                )
                              }
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                              Edit
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </main>
  );
}
