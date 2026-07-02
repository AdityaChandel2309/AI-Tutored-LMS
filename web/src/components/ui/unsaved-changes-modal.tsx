"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnsavedChangesModalProps {
  open: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export function UnsavedChangesModal({
  open,
  onContinue,
  onCancel,
}: UnsavedChangesModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">
                Unsaved Changes
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                You have unsaved changes on this page. Switching phases will
                discard your changes. Are you sure you want to continue?
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="flex-1"
              >
                Stay on Page
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={onContinue}
                className="flex-1"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
