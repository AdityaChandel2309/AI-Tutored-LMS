"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Medal, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyCertificates } from "@/lib/api/certificates";
import { apiGet } from "@/lib/api/client";
import type {
  CertificatePdfResponse,
  IssuedCertificate,
} from "@/lib/types/course";

function CertificatesSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="space-y-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-9 w-full" />
        </Card>
      ))}
    </div>
  );
}

export default function CertificatesPage() {
  const router = useRouter();
  const certificatesQuery = useMyCertificates();

  async function downloadPdf(certId: string) {
    try {
      const { url } = await apiGet<CertificatePdfResponse>(
        `/certificates/${certId}/pdf`,
      );
      window.open(url, "_blank");
    } catch (err) {
      alert(`Failed to download: ${(err as Error).message}`);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            badge={<Badge variant="success">Achievements</Badge>}
            title="My Certificates"
            description="Certificates earned from completing courses."
            actions={
              <div className="flex gap-2">
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

        <AsyncBoundary
          query={certificatesQuery}
          skeleton={<CertificatesSkeleton />}
          errorMessage="Failed to load certificates"
          empty={
            <Card className="p-8">
              <EmptyState
                icon={Trophy}
                title="No certificates yet"
                description="Complete courses to earn certificates."
                action={
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push("/dashboard/my-courses")
                    }
                  >
                    Continue Learning
                  </Button>
                }
              />
            </Card>
          }
        >
          {(certificates: IssuedCertificate[]) => (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="group relative flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_72px_-40px_rgba(15,23,42,0.45)]"
                >
                  {/* Decorative top accent */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" />

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)] transition-transform duration-200 group-hover:scale-110">
                        <Medal className="h-5 w-5" aria-hidden />
                      </div>
                      <Badge variant="success">Earned</Badge>
                    </div>

                    <h3 className="text-lg font-semibold leading-tight tracking-tight">
                      {cert.courseTitle}
                    </h3>

                    <p className="text-xs font-medium text-[var(--color-primary)]">
                      {cert.certificateNumber}
                    </p>

                    {cert.scoreSummary && (
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {cert.scoreSummary}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
                      <span>{cert.learnerName}</span>
                      <span>
                        {new Date(
                          cert.completionDate,
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => downloadPdf(cert.id)}
                    >
                      <FileText className="h-4 w-4" aria-hidden />
                      Download PDF
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>
    </main>
  );
}
