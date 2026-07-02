"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { apiPatch } from "@/lib/api/client";
import {
  useConfirmScormUpload,
  useRequestScormUpload,
} from "@/lib/api/courses";

type UploadState = "idle" | "uploading" | "confirming";

export function ScormUpload({
  courseId,
  lessonId,
  lessonTitle,
  existingPackageId,
  onUploaded,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  existingPackageId?: string | null;
  onUploaded?: (packageId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] =
    useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(
    null,
  );
  const [attachedPackageId, setAttachedPackageId] =
    useState(existingPackageId ?? null);

  const requestUpload =
    useRequestScormUpload(courseId);
  const confirmUpload = useConfirmScormUpload();

  async function startUpload(file: File) {
    setError(null);
    setProgress(0);
    setUploadState("uploading");

    try {
      const upload = await requestUpload.mutateAsync({
        title: lessonTitle || "SCORM Package",
        mimeType: file.type || "application/zip",
        fileName: file.name,
      });

      if (file.size > upload.maxSizeBytes) {
        setUploadState("idle");
        setError(
          `File exceeds the ${Math.round(upload.maxSizeBytes / 1024 / 1024)} MB limit`,
        );
        return;
      }

      if (!file.name.toLowerCase().endsWith(".zip")) {
        setUploadState("idle");
        setError("SCORM upload must be a .zip file");
        return;
      }

      await uploadFile(
        upload.uploadUrl,
        file,
        (pct) => setProgress(pct),
      );

      setUploadState("confirming");
      const confirmed =
        await confirmUpload.mutateAsync({
          packageId: upload.packageId,
          lessonId,
        });

      await apiPatch(`/lessons/${lessonId}`, {
        content: {
          scormPackageId: confirmed.id,
        },
      });

      setAttachedPackageId(confirmed.id);
      setUploadState("idle");
      onUploaded?.(confirmed.id);
    } catch (err) {
      setUploadState("idle");
      setError((err as Error).message);
    }
  }

  function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    void startUpload(file);
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-muted)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--color-foreground)]">
            SCORM package
          </p>
          {attachedPackageId ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Attached package ID: {attachedPackageId}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Upload a SCORM zip to attach it to this lesson.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={uploadState !== "idle"}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadState === "uploading"
            ? "Uploading…"
            : uploadState === "confirming"
              ? "Confirming…"
              : attachedPackageId
                ? "Replace"
                : "Upload"}
        </Button>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={onPickFile}
        className="hidden"
      />

      {uploadState === "uploading" && (
        <div className="text-xs text-[var(--color-muted-foreground)]">
          Uploading… {progress}%
        </div>
      )}

      {error && (
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
      file.type || "application/zip",
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round(
          (event.loaded / event.total) * 100,
        );
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.send(file);
  });
}
