"use client";

import {
  FilePlus,
  CheckCircle2,
  GraduationCap,
  ClipboardList,
  Medal,
  XCircle,
  Trophy,
  Video,
  Rocket,
  Megaphone,
  Pin,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsEvent } from "@/lib/types/analytics";

// Event type to lucide icon + label + badge variant (replaces the previous
// emoji glyph map). Icons are decorative (the visible label conveys the
// meaning), so they render aria-hidden with a token-driven color.
const EVENT_META: Record<string, { icon: LucideIcon; label: string; variant: "neutral" | "success" | "warning" }> = {
  "enrollment.created": { icon: FilePlus, label: "Enrolled", variant: "neutral" },
  "lesson.completed": { icon: CheckCircle2, label: "Lesson Complete", variant: "success" },
  "course.completed": { icon: GraduationCap, label: "Course Complete", variant: "success" },
  "assessment.attempted": { icon: ClipboardList, label: "Assessment", variant: "neutral" },
  "assessment.passed": { icon: Medal, label: "Passed", variant: "success" },
  "assessment.failed": { icon: XCircle, label: "Failed", variant: "warning" },
  "certificate.issued": { icon: Trophy, label: "Certificate", variant: "success" },
  "video.uploaded": { icon: Video, label: "Video Upload", variant: "neutral" },
  "scorm.launched": { icon: Rocket, label: "SCORM Launch", variant: "neutral" },
  "course.published": { icon: Megaphone, label: "Published", variant: "warning" },
};

function getEventDescription(event: AnalyticsEvent): string {
  const payload = event.payload ?? {};
  switch (event.type) {
    case "enrollment.created":
      return `Enrolled in a course`;
    case "lesson.completed":
      return `Completed a lesson`;
    case "course.completed":
      return `Completed a course`;
    case "assessment.passed":
      return `Passed an assessment (score: ${payload.score ?? "N/A"}%)`;
    case "assessment.failed":
      return `Did not pass an assessment (score: ${payload.score ?? "N/A"}%)`;
    case "assessment.attempted":
      return `Attempted an assessment`;
    case "certificate.issued":
      return `Earned certificate #${payload.certificateNumber ?? ""}`;
    default:
      return event.type.replace(/\./g, " ");
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ActivityCard({ event }: { event: AnalyticsEvent }) {
  const meta = EVENT_META[event.type] ?? { icon: Pin, label: event.type, variant: "neutral" as const };
  const Icon = meta.icon;

  return (
    <Card className="flex items-center gap-4 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)]">
        <Icon className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {formatRelativeTime(event.occurredAt)}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--color-foreground)] truncate">
          {getEventDescription(event)}
        </p>
      </div>
    </Card>
  );
}
