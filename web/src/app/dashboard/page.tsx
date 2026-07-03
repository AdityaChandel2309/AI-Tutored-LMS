"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { AdminPanel } from "@/components/admin-panel";
import { ProfilePanel } from "@/components/profile-panel";
import { NotificationBell } from "@/components/notification/notification-bell";
import { DashboardSummaryCards } from "@/components/analytics/dashboard-summary-cards";
import { ContinueLearning } from "@/components/dashboard/continue-learning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stat } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { useMe, meKeys, type DashboardUser } from "@/lib/api/me";
import { humanizeRoles } from "@/lib/brand";

// Quick-navigation cards. Each card keeps its original router.push target;
// emoji glyphs are replaced by lucide vector icons rendered aria-hidden.
type QuickNavCard = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: "primary" | "accent";
};

const QUICK_NAV: QuickNavCard[] = [
  {
    label: "Browse Courses",
    description: "Explore the course catalog and enroll",
    href: "/dashboard/courses",
    icon: BookOpen,
    accent: "primary",
  },
  {
    label: "My Courses",
    description: "Track progress and continue learning",
    href: "/dashboard/my-courses",
    icon: GraduationCap,
    accent: "accent",
  },
  {
    label: "Certificates",
    description: "View earned certificates",
    href: "/dashboard/certificates",
    icon: Award,
    accent: "accent",
  },
  {
    label: "My Activity",
    description: "View your learning timeline",
    href: "/dashboard/activity",
    icon: Activity,
    accent: "accent",
  },
];

function DashboardSkeleton() {
  return (
    <Card className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <AsyncBoundary
          query={me}
          skeleton={<DashboardSkeleton />}
          errorMessage="We couldn't load your dashboard. Please try again."
        >
          {(user) => {
            const isAdmin = user.roles.includes("admin");
            const isInstructor = user.roles.includes("instructor");
            const isLearner = user.roles.includes("learner") || (!isAdmin && !isInstructor);

            return (
              <>
                <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
                  <div className="space-y-6">
                    <SectionHeading
                      badge={<Badge variant="warning">Workspace</Badge>}
                      title="Dashboard"
                      description="Manage your learning, track progress, and keep your profile up to date."
                      actions={
                        <div className="flex items-center gap-2">
                          <NotificationBell />
                          <LogoutButton />
                        </div>
                      }
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <Stat
                        label="Email"
                        value={user.email}
                        hint="Authenticated identity"
                      />
                      <Stat
                        label="Roles"
                        value={humanizeRoles(user.roles)}
                        hint="Resolved from Keycloak"
                      />
                    </div>

                    {/* Summary cards for admins */}
                    {isAdmin && <DashboardSummaryCards />}

                    {/* Course navigation */}
                    <div className="grid gap-3 md:grid-cols-4">
                      {QUICK_NAV.map(({ label, description, href, icon: Icon, accent }) => (
                        <button
                          key={href}
                          type="button"
                          onClick={() => router.push(href)}
                          className="group flex items-center gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
                        >
                          <span
                            className={
                              accent === "primary"
                                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110"
                                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] transition-transform duration-200 group-hover:scale-110"
                            }
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <div>
                            <p className="font-semibold text-[var(--color-foreground)]">{label}</p>
                            <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>

                {isLearner && <ContinueLearning />}

                <ProfilePanel
                  user={user}
                  onUserChange={(nextUser) =>
                    queryClient.setQueryData<DashboardUser>(meKeys.me, (current) =>
                      current
                        ? {
                            ...current,
                            id: nextUser.id,
                            email: nextUser.email,
                            firstName: nextUser.firstName,
                            lastName: nextUser.lastName,
                            avatarUrl: nextUser.avatarUrl,
                          }
                        : current,
                    )
                  }
                />

                {isAdmin && <AdminPanel />}

                {(isAdmin || isInstructor) && (
                  <Card className="overflow-hidden">
                    <SectionHeading
                      badge={<Badge variant="warning">Analytics</Badge>}
                      title="Analytics"
                      description="View aggregated learning metrics."
                      actions={
                        <Button
                          variant="outline"
                          onClick={() => router.push("/dashboard/analytics")}
                        >
                          View Analytics
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Button>
                      }
                    />
                  </Card>
                )}
              </>
            );
          }}
        </AsyncBoundary>
      </div>
    </main>
  );
}
