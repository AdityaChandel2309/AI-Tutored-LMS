"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useMyActivity } from "@/lib/api/analytics";
import { ActivityCard } from "@/components/analytics/activity-card";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonCard } from "@/components/ui/skeleton";

export default function ActivityPage() {
  const router = useRouter();
  const [skip, setSkip] = useState(0);
  const take = 20;

  const activity = useMyActivity({ take, skip });
  const data = activity.data;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="overflow-hidden">
          <SectionHeading
            badge={<Badge variant="neutral">Activity</Badge>}
            title="My Activity"
            description="Your recent learning activity timeline."
            actions={
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Dashboard
              </Button>
            }
          />

          <div className="mt-4">
            <AsyncBoundary
              query={activity}
              skeleton={
                <div className="space-y-3">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              }
              errorMessage="We couldn't load your activity. Please try again."
            >
              {(timeline) => {
                // `timeline` is the ActivityTimelineResponse object ({ items, total }),
                // so AsyncBoundary's array/null empty check never fires — guard the
                // empty timeline explicitly here (mirrors the knowledge page).
                if (timeline.items.length === 0) {
                  return (
                    <EmptyState
                      title="No activity yet"
                      description="Start learning to see your progress here!"
                    />
                  );
                }

                return (
                  <div className="space-y-3">
                    {timeline.items.map((event) => (
                      <ActivityCard key={event.id} event={event} />
                    ))}
                  </div>
                );
              }}
            </AsyncBoundary>
          </div>

          {data && data.total > take && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
              <Button
                variant="outline"
                disabled={skip === 0}
                onClick={() => setSkip((prev) => Math.max(0, prev - take))}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {skip + 1}–{Math.min(skip + take, data.total)} of {data.total}
              </span>
              <Button
                variant="outline"
                disabled={skip + take >= data.total}
                onClick={() => setSkip((prev) => prev + take)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
