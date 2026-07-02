"use client";

import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  FileText,
  Package,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

// Maps a lesson `type` to a representative icon, mirroring how Coursera/Udemy
// signal content kind at a glance in the course-content sidebar.
const LESSON_TYPE_ICONS: Record<string, LucideIcon> = {
  video: PlayCircle,
  text: FileText,
  reading: BookOpen,
  quiz: CircleHelp,
  assignment: ClipboardList,
  scorm: Package,
};

export function lessonTypeIcon(type: string): LucideIcon {
  return LESSON_TYPE_ICONS[type] ?? FileText;
}

// Renders the icon for a lesson type. Using a stable module-level component
// (rather than assigning the icon to a capitalized local inside render) keeps
// the React component identity stable across renders.
export function LessonTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = LESSON_TYPE_ICONS[type] ?? FileText;
  return <Icon className={className} aria-hidden />;
}

// Human-readable label for a lesson type.
export function lessonTypeLabel(type: string): string {
  switch (type) {
    case "video":
      return "Video";
    case "text":
      return "Reading";
    case "reading":
      return "Reading";
    case "quiz":
      return "Quiz";
    case "assignment":
      return "Assignment";
    case "scorm":
      return "Interactive";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// Formats a duration in seconds as a compact "Xh Ym" / "Ym" / "Xs" label.
// Returns null when there is no usable duration so callers can omit it.
export function formatDuration(
  seconds: number | null | undefined,
): string | null {
  if (!seconds || seconds <= 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes} min`;
  }
  return `${total}s`;
}
