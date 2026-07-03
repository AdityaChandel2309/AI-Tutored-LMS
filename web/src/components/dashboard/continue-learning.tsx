"use client";

import { useRouter } from "next/navigation";
import { PlayCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyEnrollments } from "@/lib/api/courses";

export function ContinueLearning() {
  const router = useRouter();
  const { data, isLoading } = useMyEnrollments();

  if (isLoading) {
    return (
      <Card className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-9 w-40" />
      </Card>
    );
  }

  const inProgress = (data ?? [])
    .filter((e) => !e.completedAt && e.progress > 0 && e.progress < 1)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

  const next = inProgress[0] ?? (data ?? []).find((e) => !e.completedAt);
  if (!next) return null;

  const pct = Math.round(next.progress * 100);

  return (
    <Card
      className="overflow-hidden"
      style={{
        background:
          "linear-gradient(120deg, color-mix(in oklch, var(--color-primary) 12%, var(--color-card)), var(--color-card) 60%)",
        boxShadow: "var(--shadow-lift)",
      }}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="warning">Continue learning</Badge>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Pick up where you left off
            </span>
          </div>
          <h2 className="truncate text-2xl font-semibold text-[var(--color-foreground)]">
            {next.course.title}
          </h2>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
              <span>Your progress</span>
              <span className="tabular-nums font-medium">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background:
                    "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            onClick={() => router.push(`/dashboard/courses/${next.courseId}`)}
          >
            <PlayCircle className="h-4 w-4" aria-hidden />
            Resume
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/my-courses")}
          >
            All courses
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </Card>
  );
}