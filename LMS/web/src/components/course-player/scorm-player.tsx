"use client";

import { useEffect, useRef, useCallback } from "react";
import { Notice } from "@/components/ui/notice";
import { useScormLaunch } from "@/lib/api/courses";
import { useQueryClient } from "@tanstack/react-query";

declare global {
  interface Window {
    ScormRuntime: new (config: {
      packageId: string;
      apiBaseUrl: string;
      onStatusChange?: (status: string) => void;
    }) => {
      install: () => void;
    };
  }
}

export function ScormPlayer({
  packageId,
  onComplete,
}: {
  packageId: string;
  onComplete?: () => void;
}) {
  const { data, isLoading, error } = useScormLaunch(packageId);
  const runtimeInstalled = useRef(false);
  const queryClient = useQueryClient();

  const handleStatusChange = useCallback(
    (status: string) => {
      if (status === "completed" || status === "passed") {
        // Invalidate progress queries so sidebar dots update
        queryClient.invalidateQueries({ queryKey: ["course-progress"] });
        onComplete?.();
      }
    },
    [onComplete, queryClient],
  );

  // Inject the SCORM runtime API script once launch data is available
  useEffect(() => {
    if (!data?.launchPath || runtimeInstalled.current) return;

    const script = document.createElement("script");
    script.src = "/scorm-api.js";
    script.onload = () => {
      if (window.ScormRuntime) {
        const runtime = new window.ScormRuntime({
          packageId,
          apiBaseUrl: "/api",
          onStatusChange: handleStatusChange,
        });
        runtime.install();
        runtimeInstalled.current = true;
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [data, packageId, handleStatusChange]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)] p-10">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Loading SCORM package…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="danger">
        {(error as Error).message ?? "Unable to load SCORM package"}
      </Notice>
    );
  }

  if (!data?.launchPath) {
    return <Notice>No launch path found.</Notice>;
  }

  const launchUrl = `/api/scorm/${packageId}/files/${encodeURIComponent(
    data.launchPath,
  )}`;

  return (
    <div className="space-y-3">
      <iframe
        title={data.title}
        src={launchUrl}
        className="h-[600px] w-full rounded-xl border border-[var(--color-border)] bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="fullscreen"
      />
      <p className="text-xs text-[var(--color-muted-foreground)]">
        SCORM {data.scormVersion ?? "package"} loaded — progress is tracked
        automatically.
      </p>
    </div>
  );
}
