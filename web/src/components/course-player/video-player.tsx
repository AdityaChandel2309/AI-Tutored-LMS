"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui/notice";
import { useVideoStreamUrl } from "@/lib/api/courses";

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const RESUME_KEY_PREFIX = "lms:video-progress:";
// Don't restore near the very start (annoying) or the very end (already done).
const RESUME_MIN_SECONDS = 5;
const RESUME_MAX_FRACTION = 0.95;

export function VideoPlayer({
  videoId,
  posterUrl,
  captionsUrl,
}: {
  videoId: string;
  posterUrl?: string | null;
  // Optional WebVTT track. When provided, the CC toggle appears.
  captionsUrl?: string | null;
}) {
  const { data, isLoading, error } = useVideoStreamUrl(videoId);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(false);

  // Sync captions visibility with the underlying TextTrack.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !captionsUrl) return;
    const track = video.textTracks[0];
    if (track) track.mode = captionsOn ? "showing" : "hidden";
  }, [captionsOn, captionsUrl]);

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
      >
        {captionsUrl && (
          <track
            kind="captions"
            srcLang="en"
            label="English"
            src={captionsUrl}
            default={captionsOn}
          />
        )}
      </video>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-3">
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
          {captionsUrl && (
            <button
              type="button"
              onClick={() => setCaptionsOn((v) => !v)}
              aria-pressed={captionsOn}
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                captionsOn
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
              title={captionsOn ? "Hide captions" : "Show captions"}
            >
              CC
            </button>
          )}
        </div>
        <span>Link expires {new Date(data.expiresAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
