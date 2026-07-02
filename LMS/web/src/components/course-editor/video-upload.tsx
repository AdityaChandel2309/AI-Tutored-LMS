"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload, X, FileVideo, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { apiPatch } from "@/lib/api/client";
import {
  useConfirmVideoUpload,
  useRequestVideoUpload,
} from "@/lib/api/courses";

type UploadState = "idle" | "uploading" | "confirming" | "done" | "error";

export function VideoUpload({
  courseId,
  lessonId,
  lessonTitle,
  existingVideoId,
  onUploaded,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  existingVideoId?: string | null;
  onUploaded?: (videoId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>(
    existingVideoId ? "done" : "idle",
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attachedVideoId, setAttachedVideoId] = useState(existingVideoId ?? null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const requestUpload = useRequestVideoUpload(courseId);
  const confirmUpload = useConfirmVideoUpload();

  async function startUpload(file: File) {
    setError(null);
    setProgress(0);
    setUploadState("uploading");
    setSelectedFileName(file.name);

    try {
      const upload = await requestUpload.mutateAsync({
        title: lessonTitle || "Lesson video",
        mimeType: file.type || "video/mp4",
        fileName: file.name,
      });

      if (file.size > upload.maxSizeBytes) {
        setUploadState("error");
        setError(
          `File exceeds the ${Math.round(upload.maxSizeBytes / 1024 / 1024)} MB limit`,
        );
        return;
      }

      await uploadFile(upload.uploadUrl, file, (pct) => setProgress(pct));

      setUploadState("confirming");
      const confirmed = await confirmUpload.mutateAsync({
        videoId: upload.videoId,
        lessonId,
      });

      await apiPatch(`/lessons/${lessonId}`, {
        content: {
          videoId: confirmed.id,
          posterUrl: null,
        },
      });

      setAttachedVideoId(confirmed.id);
      setUploadState("done");
      onUploaded?.(confirmed.id);
    } catch (err) {
      setUploadState("error");
      setError((err as Error).message);
    }
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    void startUpload(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void startUpload(file);
  }

  function removeFile() {
    setSelectedFileName(null);
    setProgress(0);
    setUploadState(existingVideoId ? "done" : "idle");
    setError(null);
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function getFileSizeFromProgress(uploaded: number): number {
    // Approximate total size from progress percentage during XHR upload
    return Math.round((uploaded / 100) * 500 * 1024 * 1024); // max 500MB estimate
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Dropzone */}
      {(uploadState === "idle" || uploadState === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer
            transition-all duration-200 select-none
            ${isDragging
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
              : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-muted)]/50"
            }
          `}
        >
          <div className={`
            flex h-12 w-12 items-center justify-center rounded-full
            ${isDragging ? "bg-[var(--color-primary)]/10" : "bg-[var(--color-muted)]"}
            transition-colors duration-200
          `}>
            <Upload className={`h-5 w-5 ${isDragging ? "text-[var(--color-primary)]" : "text-[var(--color-muted-foreground)]"}`} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-foreground)]">
              {isDragging ? "Drop video file here" : "Drag and drop a video file"}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              or{" "}
              <span className="text-[var(--color-primary)] font-medium underline underline-offset-2">
                browse files
              </span>
            </p>
            <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
              MP4, MOV, AVI, WebM — max 500 MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>
      )}

      {/* Upload in progress */}
      {uploadState === "uploading" && (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] p-4">
          <div className="flex items-center gap-3">
            <FileVideo className="h-5 w-5 flex-shrink-0 text-[var(--color-primary)]" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                {selectedFileName}
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Uploading… {progress}%
              </p>
            </div>
            <button
              onClick={removeFile}
              className="flex-shrink-0 rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Confirming */}
      {uploadState === "confirming" && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] px-4 py-3">
          <FileVideo className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Processing video…
          </p>
        </div>
      )}

      {/* Done / attached */}
      {uploadState === "done" && attachedVideoId && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-muted)] px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-foreground)]">
              Video attached
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)] truncate">
              ID: {attachedVideoId}
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
          >
            Replace
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={onPickFile}
            className="hidden"
          />
        </div>
      )}

      {/* Error */}
      {uploadState === "error" && error && (
        <Notice variant="danger">{error}</Notice>
      )}
    </div>
  );
}

function uploadFile(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
