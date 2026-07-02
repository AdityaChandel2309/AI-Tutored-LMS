"use client";

import { PortalLayout } from "@/components/portal/portal-layout";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </PortalLayout>
  );
}
