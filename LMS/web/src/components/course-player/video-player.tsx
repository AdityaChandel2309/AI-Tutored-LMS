"use client";

import { useEffect, useRef } from "react";
import { Notice } from "@/components/ui/notice";
import { useVideoStreamUrl } from "@/lib/api/courses";

// Fraction of the video that must be watched before it counts as complete.
// Mirrors the Udemy/Coursera convention of ~90%.
const COMPLETION_THRESHOLD = 0.9;

export function VideoPlayer({
  videoId,
  posterUrl,
  onComplete,
}: {
  videoId: string;
  posterUrl?: string | null;
  // Fired once when the learner crosses the completion threshold.
  onComplete?: () => void;
}) {
  const { data, isLoading, error } = useVideoStreamUrl(videoId);

  // Ensures the completion event only fires a single time per video.
  const firedRef = useRef(false);
  // Keep the latest onComplete without re-binding handlers each render.
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Reset the one-shot guard when the video changes (lesson navigation).
  useEffect(() => {
    firedRef.current = false;
  }, [videoId]);

  function fireComplete() {
    if (firedRef.current) return;
    firedRef.current = true;
    onCompleteRef.current?.();
  }

  function handleTimeUpdate(
    event: React.SyntheticEvent<HTMLVideoElement>,
  ) {
    if (firedRef.current) return;
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) {
      return;
    }
    const watched = video.currentTime / video.duration;
    if (watched >= COMPLETION_THRESHOLD) {
      fireComplete();
    }
  }

  // Some browsers fire `ended` slightly differently; treat it as a guaranteed
  // completion in case the user seeks straight to the end.
  function handleEnded() {
    fireComplete();
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card-muted)] p-6 text-sm text-[var(--color-muted-foreground)]">
        Loading video…
      </div>
    );
  }

  if (error) {
    return (
      <Notice variant="danger">
        {(error as Error).message ?? "Unable to load video"}
      </Notice>
    );
  }

  if (!data?.url) {
    return <Notice>Video is not available yet.</Notice>;
  }

  return (
    <div className="space-y-2">
      <video
        controls
        playsInline
        className="w-full rounded-xl border border-[var(--color-border)] bg-black"
        src={data.url}
        poster={posterUrl ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Streaming link expires at{" "}
        {new Date(data.expiresAt).toLocaleString()}
      </p>
    </div>
  );
}
