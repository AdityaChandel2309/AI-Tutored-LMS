"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddModule } from "@/lib/api/courses";

interface CreateModuleModalProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
}

export function CreateModuleModal({
  courseId,
  open,
  onClose,
}: CreateModuleModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const addModule = useAddModule(courseId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addModule.mutate(
      title.trim(),
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          onClose();
        },
      },
    );
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold tracking-tight">
            Create Chapter
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-foreground)]">
              Chapter title <span className="text-[var(--color-danger)]">*</span>
            </label>
            <Input
              placeholder="e.g. Getting Started with Python"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-foreground)]">
              Chapter description{" "}
              <span className="text-[var(--color-muted-foreground)] font-normal">
                (optional)
              </span>
            </label>
            <textarea
              placeholder="Briefly describe what students will learn in this chapter…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1"
              maxLength={500}
            />
          </div>

          {addModule.error && (
            <p className="text-xs text-[var(--color-danger)]">
              {(addModule.error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addModule.isPending || !title.trim()}
            >
              {addModule.isPending ? "Creating…" : "Create Chapter"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
