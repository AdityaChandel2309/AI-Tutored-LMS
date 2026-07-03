import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function VerifyNotFound() {
  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,var(--color-danger-soft),var(--color-background))] px-4 py-16">
      <div className="mx-auto max-w-md">
        <Card className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Certificate not found</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              We couldn't verify a certificate with that code. Double-check the code and try again.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            Go home
          </Link>
        </Card>
      </div>
    </main>
  );
}