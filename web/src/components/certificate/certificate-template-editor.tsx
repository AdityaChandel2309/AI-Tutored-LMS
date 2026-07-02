"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import {
  useCertificateTemplate,
  useCreateCertificateTemplate,
  useUpdateCertificateTemplate,
} from "@/lib/api/certificates";

export function CertificateTemplateEditor({
  courseId,
}: {
  courseId: string;
}) {
  const {
    data: template,
    isLoading,
    error,
  } = useCertificateTemplate(courseId);
  const createMut = useCreateCertificateTemplate(courseId);
  const updateMut = useUpdateCertificateTemplate(
    template?.id ?? "",
    courseId,
  );

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("Certificate of Completion");
  const [description, setDescription] = useState("");

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  if (isLoading) {
    return <Notice>Loading certificate template…</Notice>;
  }

  // No template yet — show create form
  if (error || !template) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏅</span>
            <h3 className="text-base font-semibold tracking-tight">
              Certificate Template
            </h3>
          </div>
          {!showCreate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreate(true)}
            >
              + Add Certificate
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                Certificate Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Certificate of Completion"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
                Description (optional)
              </label>
              <textarea
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Awarded for completing the full course"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!title.trim() || createMut.isPending}
                onClick={() =>
                  createMut.mutate(
                    {
                      title: title.trim(),
                      description: description.trim() || undefined,
                    },
                    {
                      onSuccess: () => setShowCreate(false),
                    },
                  )
                }
              >
                {createMut.isPending ? "Creating…" : "Create Template"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>

            {createMut.isError && (
              <Notice variant="danger">
                {(createMut.error as Error).message}
              </Notice>
            )}
          </div>
        )}

        {!showCreate && (
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            No certificate template configured. Learners won&apos;t receive certificates upon completion.
          </p>
        )}
      </Card>
    );
  }

  // Template exists — show details with edit
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏅</span>
          <h3 className="text-base font-semibold tracking-tight">
            Certificate Template
          </h3>
          <Badge variant={template.isActive ? "success" : "neutral"}>
            {template.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditTitle(template.title);
              setEditDesc(template.description ?? "");
              setEditing(true);
            }}
          >
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
              Title
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted-foreground)]">
              Description
            </label>
            <textarea
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={template.isActive}
                onChange={(e) =>
                  updateMut.mutate({ isActive: e.target.checked })
                }
                className="rounded"
              />
              Active
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!editTitle.trim() || updateMut.isPending}
              onClick={() =>
                updateMut.mutate(
                  {
                    title: editTitle.trim(),
                    description: editDesc.trim() || undefined,
                  },
                  { onSuccess: () => setEditing(false) },
                )
              }
            >
              {updateMut.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>

          {updateMut.isError && (
            <Notice variant="danger">
              {(updateMut.error as Error).message}
            </Notice>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {template.title}
          </p>
          {template.description && (
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {template.description}
            </p>
          )}
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Learners who complete this course will automatically receive a certificate.
          </p>
        </div>
      )}
    </Card>
  );
}
