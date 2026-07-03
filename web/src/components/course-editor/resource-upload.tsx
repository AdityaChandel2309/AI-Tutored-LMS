"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Upload, X, FileText, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import {
  fetchResourceDownloadUrl,
  useConfirmResourceUpload,
  useDeleteResource,
  useLessonResources,
  useRequestResourceUpload,
} from "@/lib/api/lesson-resources";

type UploadState = "idle" | "uploading" | "confirming" | "error";

function formatBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function putFile(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export function ResourceUploader({ lessonId }: { lessonId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const request = useRequestResourceUpload(lessonId);
  const confirm = useConfirmResourceUpload(lessonId);
  const remove = useDeleteResource(lessonId);
  const { data: resources = [], isLoading } = useLessonResources(lessonId);

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    setFileName(file.name);
    setState("uploading");
    try {
      const ticket = await request.mutateAsync({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        label: label.trim() || file.name,
      });
      if (file.size > ticket.maxSizeBytes) {
        setState("error");
        setError(
          `File exceeds ${Math.round(ticket.maxSizeBytes / 1024 / 1024)} MB limit`,
        );
        return;
      }
      await putFile(ticket.uploadUrl, file, setProgress);
      setState("confirming");
      await confirm.mutateAsync({
        resourceId: ticket.resourceId,
        objectKey: ticket.objectKey,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        label: label.trim() || file.name,
      });
      setState("idle");
      setFileName(null);
      setLabel("");
      setProgress(0);
    } catch (err) {
      setState("error");
      setError((err as Error).message);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void handleFile(f);
  }

  async function download(id: string) {
    try {
      const { url } = await fetchResourceDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-2">
        <label className="text-xs font-medium text-[var(--color-foreground)]">
          Resource label (optional)
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Course workbook"
          className="text-sm"
          disabled={state === "uploading" || state === "confirming"}
        />
        <div className="flex items-center gap-3 pt-1">
          <Input
            value={fileName ?? "No file selected"}
            readOnly
            className="flex-1 text-sm text-[var(--color-muted-foreground)]"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={state === "uploading" || state === "confirming"}
          >
            <Upload className="h-3.5 w-3.5" />
            {state === "uploading"
              ? `Uploading ${progress}%`
              : state === "confirming"
                ? "Saving…"
                : "Select File"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={onPick}
          />
        </div>
        {state === "uploading" && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <p className="text-[10px] text-[var(--color-muted-foreground)]">
          PDF, ZIP, DOCX, images, or any file up to 100 MB.
        </p>
      </div>

      {error && (
        <Notice variant="danger">
          <span className="flex items-center gap-2">
            {error}
            <button onClick={() => setError(null)} aria-label="Dismiss">
              <X className="h-3 w-3" />
            </button>
          </span>
        </Notice>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          Attached resources ({resources.length})
        </p>
        {isLoading ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Loading…
          </p>
        ) : resources.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            No resources attached yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.label}</p>
                  <p className="truncate text-[10px] text-[var(--color-muted-foreground)]">
                    {r.fileName} · {formatBytes(r.sizeBytes)}
                  </p>
                </div>
                <button
                  onClick={() => download(r.id)}
                  className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(r.id)}
                  disabled={remove.isPending}
                  className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-destructive)]/10 hover:text-[var(--color-destructive)]"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}