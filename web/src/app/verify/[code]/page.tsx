import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Award, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

type VerifiedCertificate = {
  certificateNumber: string;
  learnerName: string;
  courseTitle: string;
  completionDate: string;
  issuedAt: string;
  scoreSummary?: string | null;
  templateTitle?: string | null;
  organization?: string | null;
  valid: boolean;
};

async function fetchCertificate(code: string): Promise<VerifiedCertificate | null> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3001";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/certificates/verify/${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Verification failed (${res.status})`);
  const json = (await res.json()) as { data?: VerifiedCertificate } | VerifiedCertificate;
  return "data" in json && json.data ? json.data : (json as VerifiedCertificate);
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return {
    title: `Verify certificate ${code}`,
    description: "Confirm the authenticity of a certificate issued through the platform.",
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await fetchCertificate(code);

  if (!cert) return notFound();

  const completion = new Date(cert.completionDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const issued = new Date(cert.issuedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,var(--color-primary-soft),var(--color-background))] px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-[var(--color-success-soft)] px-6 py-4 text-[var(--color-success)]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Certificate verified</p>
              <p className="text-xs opacity-80">
                This certificate was issued by the platform and has not been revoked.
              </p>
            </div>
          </div>

          <div className="space-y-6 px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Award className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {cert.templateTitle ?? "Certificate of Completion"}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">{cert.learnerName}</h1>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                has successfully completed
              </p>
              <p className="text-lg font-medium text-[var(--color-foreground)]">
                {cert.courseTitle}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-muted)] p-4 text-left text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Completed on
                </dt>
                <dd className="mt-1 font-medium">{completion}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Issued on
                </dt>
                <dd className="mt-1 font-medium">{issued}</dd>
              </div>
              {cert.scoreSummary && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    Score
                  </dt>
                  <dd className="mt-1 font-medium">{cert.scoreSummary}</dd>
                </div>
              )}
              {cert.organization && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    Issued by
                  </dt>
                  <dd className="mt-1 font-medium">{cert.organization}</dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Verification code
                </dt>
                <dd className="mt-1 inline-flex items-center gap-2 font-mono text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" aria-hidden />
                  {cert.certificateNumber}
                </dd>
              </div>
            </dl>
          </div>
        </Card>

        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
          Something look wrong?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>{" "}
          to report this certificate.
        </p>
      </div>
    </main>
  );
}