"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InstructorSummary } from "@/components/analytics/instructor-summary";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AnalyticsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden">
          <SectionHeading
            badge={<Badge variant="warning">Analytics</Badge>}
            title="Analytics Overview"
            description="Aggregated learning metrics across your tenant."
            actions={
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Dashboard
              </Button>
            }
          />
          <div className="mt-4">
            <InstructorSummary />
          </div>
        </Card>
      </div>
    </main>
  );
}
