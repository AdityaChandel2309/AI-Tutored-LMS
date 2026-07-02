"use client";

// ─── AsyncBoundary ─────────────────────────
// Reusable wrapper that renders the four canonical data-loading states from a
// react-query result: loading → Skeleton, error → Notice, empty → EmptyState,
// success → children(data). The session-expiry redirect is invoked from any
// state via useSessionExpiryRedirect so a 401 always redirects.

import type { ReactNode } from "react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { useSessionExpiryRedirect } from "@/lib/api/use-session-expiry-redirect";

// Minimal react-query-compatible result shape. Accepts useQuery results
// (which expose isLoading/isPending/isError/error/data).
export interface AsyncBoundaryQuery<T> {
  isLoading?: boolean;
  isPending?: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
}

export interface AsyncBoundaryProps<T> {
  query: AsyncBoundaryQuery<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  empty?: ReactNode;
  errorMessage?: string;
}

// A result is "empty" when there is no data, or when the data is an empty array.
function isEmpty(data: unknown): boolean {
  if (data == null) {
    return true;
  }
  if (Array.isArray(data) && data.length === 0) {
    return true;
  }
  return false;
}

export function AsyncBoundary<T>({
  query,
  children,
  skeleton,
  empty,
  errorMessage,
}: AsyncBoundaryProps<T>) {
  // Hooks must run unconditionally — fire the redirect guard from any state.
  useSessionExpiryRedirect(query.error);

  const isLoading = query.isLoading || query.isPending;

  if (isLoading) {
    return <>{skeleton ?? <SkeletonCard />}</>;
  }

  if (query.isError) {
    return (
      <Notice variant="danger">
        {errorMessage ?? "Something went wrong"}
      </Notice>
    );
  }

  if (isEmpty(query.data)) {
    return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  }

  return <>{children(query.data as T)}</>;
}
