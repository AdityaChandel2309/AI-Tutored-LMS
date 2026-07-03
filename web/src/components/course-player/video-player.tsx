"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { useVideoStreamUrl } from "@/lib/api/courses";

// Fraction of the video that must be watched before it counts as complete.
// Mirrors the Udemy/Coursera convention of ~90%.
const COMPLETION_THRESHOLD = 0.9;

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const RESUME_KEY_PREFIX = "lms:video-progress:";
// Don't restore near the very start (annoying) or the very end (already done).
const RESUME_MIN_SECONDS = 5;
const RESUME_MAX_FRACTION = 0.95;

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

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

  // Persist playback rate onto the video element whenever it changes.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    video.playbackRate = playbackRate;
    try {
      const raw = localStorage.getItem(RESUME_KEY_PREFIX + videoId);
      const seconds = raw ? Number(raw) : NaN;
      if (
        Number.isFinite(seconds) &&
        seconds >= RESUME_MIN_SECONDS &&
        video.duration &&
        seconds / video.duration < RESUME_MAX_FRACTION
      ) {
        video.currentTime = seconds;
      }
    } catch {
      // localStorage unavailable — ignore.
    }
  }

  function fireComplete() {
    if (firedRef.current) return;
    firedRef.current = true;
    onCompleteRef.current?.();
    try {
      localStorage.removeItem(RESUME_KEY_PREFIX + videoId);
    } catch {
      // ignore
    }
  }

  function handleTimeUpdate(
    event: React.SyntheticEvent<HTMLVideoElement>,
  ) {
    const video = event.currentTarget;
    if (!video.duration || Number.isNaN(video.duration)) {
      return;
    }
    // Persist resume position (throttled to whole seconds).
    try {
      const t = Math.floor(video.currentTime);
      if (t > 0 && t % 3 === 0) {
        localStorage.setItem(RESUME_KEY_PREFIX + videoId, String(t));
      }
    } catch {
      // ignore
    }
    if (firedRef.current) return;
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
        ref={videoRef}
        controls
        playsInline
        className="w-full rounded-xl border border-[var(--color-border)] bg-black"
        src={data.url}
        poster={posterUrl ?? undefined}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-2">
          <label htmlFor="video-speed" className="font-medium">Speed</label>
          <select
            id="video-speed"
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs"
          >
            {PLAYBACK_SPEEDS.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </div>
        <span>Link expires {new Date(data.expiresAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
