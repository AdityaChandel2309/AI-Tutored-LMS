"use client";

import {
  Bell,
  BookOpen,
  CheckCircle2,
  Award,
  GraduationCap,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@/lib/api/notifications";
import type { Notification } from "@/lib/types/course";

const TYPE_META: Record<string, { icon: LucideIcon; tone: string; label: string }> = {
  "enrollment.created": {
    icon: BookOpen,
    tone: "text-[var(--color-primary)] bg-[var(--color-primary-soft)]",
    label: "Enrollment",
  },
  "assessment.passed": {
    icon: CheckCircle2,
    tone: "text-[var(--color-success)] bg-[color:color-mix(in_oklch,var(--color-success)_15%,transparent)]",
    label: "Assessment",
  },
  "certificate.issued": {
    icon: Award,
    tone: "text-[var(--color-accent)] bg-[var(--color-accent-soft)]",
    label: "Certificate",
  },
  "course.completed": {
    icon: GraduationCap,
    tone: "text-[var(--color-accent)] bg-[var(--color-accent-soft)]",
    label: "Course",
  },
};

const DEFAULT_META = {
  icon: Megaphone,
  tone: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]",
  label: "Update",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)}d ago`;
  }
  return d.toLocaleDateString();
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const query = useNotifications(50);
  const { data: countData } = useUnreadCount();
  const markRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const unread = countData?.unreadCount ?? 0;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <SectionHeading
          badge={
            <Badge variant={unread > 0 ? "warning" : "neutral"}>
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </Badge>
          }
          title="Notifications"
          description="Enrollment updates, assessment results, certificates, and course activity."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={unread === 0 || markAll.isPending}
            >
              Mark all as read
            </Button>
          }
        />

        <AsyncBoundary
          query={query}
          skeleton={<NotificationsSkeleton />}
          errorMessage="We couldn't load your notifications. Please try again."
          empty={
            <Card className="p-10">
              <EmptyState
                icon={Bell}
                title="You're all caught up"
                description="New activity from your courses and certificates will appear here."
              />
            </Card>
          }
        >
          {(items: Notification[]) => (
            <div className="space-y-2">
              {items.map((n) => {
                const meta = TYPE_META[n.type] ?? DEFAULT_META;
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.isRead) markRead.mutate(n.id);
                    }}
                    className={`group flex w-full items-start gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-all duration-150 hover:border-[color:color-mix(in_oklch,var(--color-primary)_45%,var(--color-border))] hover:shadow-[var(--shadow-lift)] ${
                      !n.isRead ? "bg-[var(--color-primary-soft)]" : ""
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${meta.tone}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                          {meta.label}
                        </span>
                        {!n.isRead && (
                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        {n.title}
                      </p>
                      <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                        {n.body}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}