"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Lock,
  Check,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { useCourseWorkflow } from "@/lib/api/courses";
import { useMe } from "@/lib/api/me";
import { CertificateTemplateEditor } from "@/components/certificate/certificate-template-editor";
import type { Course, CourseModule } from "@/lib/types/course";

const statusVariant = (
  s: string,
): "success" | "warning" | "neutral" => {
  if (s === "published") return "success";
  if (s === "draft" || s === "review") return "warning";
  return "neutral";
};

function getCourseChecklist(course: Course) {
  const totalLessons = course.modules.reduce(
    (sum: number, m: CourseModule) => sum + m.lessons.length,
    0,
  );

  return [
    {
      label: "Add a course title",
      done: Boolean(course.title?.trim()),
    },
    {
      label: "Add a course description",
      done: Boolean(course.description?.trim()),
    },
    {
      label: "Select a category",
      done: Boolean(course.category),
    },
    {
      label: "Add at least 1 section",
      done: course.modules.length > 0,
    },
    {
      label: "Add at least 1 lecture",
      done: totalLessons > 0,
    },
  ];
}

export function LandingPhase({ course }: { course: Course }) {
  const qc = useQueryClient();
  const [workflowBanner, setWorkflowBanner] = useState<{
    variant: "success" | "warning" | "danger";
    message: string;
  } | null>(null);

  const workflow = useCourseWorkflow(course.id);
  const { data: me } = useMe();
  const isSuperAdmin = me?.roles?.includes("super_admin") ?? false;

  function handleWorkflowAction(
    action: "submit-review" | "publish" | "archive" | "unpublish",
  ) {
    setWorkflowBanner(null);
    workflow.mutate(action, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["course", course.id] });
        if (action === "submit-review") {
          setWorkflowBanner({
            variant: "success",
            message: "Course submitted for review. An admin will approve it shortly.",
          });
        } else if (action === "publish") {
          setWorkflowBanner({
            variant: "success",
            message: "Course is now live and visible to students.",
          });
        } else if (action === "archive") {
          setWorkflowBanner({
            variant: "warning",
            message: "Course has been archived.",
          });
        } else if (action === "unpublish") {
          setWorkflowBanner({
            variant: "warning",
            message: "Course is no longer published.",
          });
        }
      },
      onError: (err) => {
        setWorkflowBanner({
          variant: "danger",
          message: err instanceof Error ? err.message : "Action failed",
        });
      },
    });
  }

  const canSubmitReview = course.status === "draft";
  // Only super_admin may publish; the button is hidden for everyone else.
  const canPublish = course.status === "review" && isSuperAdmin;
  const canArchive = course.status === "published";
  const canUnpublish = course.status === "review" || course.status === "archived";
  const checklist = getCourseChecklist(course);
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistTotal = checklist.length;

  return (
    <div className="space-y-6">
      {/* Pre-flight checklist */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Publish Requirements
          </h2>
          <Badge variant="neutral" className="text-xs">
            {checklistDone}/{checklistTotal} complete
          </Badge>
        </div>
        <ul className="space-y-2">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-500" />
              )}
              <span
                className={
                  item.done
                    ? "text-[var(--color-foreground)]"
                    : "text-amber-700 dark:text-amber-400"
                }
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Workflow card */}
      <Card className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Publish</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Review your course and publish it to make it available to students.
          </p>
        </div>

        {/* Current status */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Current status:
          </span>
          <Badge variant={statusVariant(course.status)}>{course.status}</Badge>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {course._count?.enrollments ?? 0} enrollment{course._count?.enrollments !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Visibility */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Visibility:
          </span>
          {course.visibility === "public" ? (
            <span className="flex items-center gap-1.5 text-sm">
              <Globe className="h-4 w-4 text-green-600" />
              Public — anyone can enroll
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm">
              <Lock className="h-4 w-4 text-amber-600" />
              Private — manual enrollment only
            </span>
          )}
        </div>

        {/* Workflow actions */}
        <div className="flex flex-wrap gap-3">
          {canSubmitReview && (
            <Button
              disabled={workflow.isPending}
              onClick={() => handleWorkflowAction("submit-review")}
            >
              {workflow.isPending ? "Submitting…" : "Submit for Review"}
            </Button>
          )}
          {canPublish && (
            <Button
              disabled={workflow.isPending}
              onClick={() => handleWorkflowAction("publish")}
            >
              <Check className="h-4 w-4" />
              {workflow.isPending ? "Publishing…" : "Publish Course"}
            </Button>
          )}
          {canArchive && (
            <Button
              variant="outline"
              disabled={workflow.isPending}
              onClick={() => handleWorkflowAction("archive")}
            >
              Archive
            </Button>
          )}
          {canUnpublish && (
            <Button
              variant="ghost"
              disabled={workflow.isPending}
              onClick={() => handleWorkflowAction("unpublish")}
            >
              ↩ Unpublish
            </Button>
          )}
        </div>

        {workflowBanner && (
          <Notice variant={workflowBanner.variant}>
            {workflowBanner.message}
          </Notice>
        )}
      </Card>

      {/* Certificate */}
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Certificate Template
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Customize the certificate that students receive upon course completion.
          </p>
        </div>
        <CertificateTemplateEditor courseId={course.id} />
      </Card>

      {/* Course info */}
      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Course Information
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Review the information shown to students on the course catalog.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Title</span>
            <span className="font-medium">{course.title}</span>
          </div>
          {course.category && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">Category</span>
              <span className="font-medium">{course.category.name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">Slug</span>
            <span className="font-mono text-xs">{course.slug}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
