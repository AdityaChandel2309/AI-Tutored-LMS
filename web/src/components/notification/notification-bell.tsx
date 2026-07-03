"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Award,
  GraduationCap,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "@/lib/api/notifications";

const TYPE_META: Record<string, { icon: LucideIcon; tone: string }> = {
  "enrollment.created": { icon: BookOpen, tone: "text-[var(--color-primary)] bg-[var(--color-primary-soft)]" },
  "assessment.passed": { icon: CheckCircle2, tone: "text-[var(--color-success)] bg-[color:color-mix(in_oklch,var(--color-success)_15%,transparent)]" },
  "certificate.issued": { icon: Award, tone: "text-[var(--color-accent)] bg-[var(--color-accent-soft)]" },
  "course.completed": { icon: GraduationCap, tone: "text-[var(--color-accent)] bg-[var(--color-accent-soft)]" },
};
const DEFAULT_META = { icon: Megaphone, tone: "text-[var(--color-muted-foreground)] bg-[var(--color-muted)]" };

function timeAgo(dateStr: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: countData } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();

  const unread = countData?.unreadCount ?? 0;

  // Close on click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition-colors duration-200 hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold text-white ring-2 ring-[var(--color-card)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Notifications
            </h3>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-hover)]"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {!notifications || notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? DEFAULT_META;
                const Icon = meta.icon;
                return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markRead.mutate(n.id);
                  }}
                  className={`flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-[var(--color-muted)] ${
                    !n.isRead
                      ? "bg-[var(--color-primary-soft)]"
                      : ""
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight text-[var(--color-foreground)]">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted-foreground)] line-clamp-2">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-primary)]" />
                  )}
                </button>
                );
              })
            )}
          </div>
          {/* Footer */}
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-[var(--color-border)] bg-[var(--color-card-muted)] px-4 py-2.5 text-center text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-muted)]"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
