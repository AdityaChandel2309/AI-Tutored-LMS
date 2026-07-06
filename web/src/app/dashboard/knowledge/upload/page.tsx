"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument, getDocumentCategories } from "@/lib/api/knowledge";
import type { DocumentCategory } from "@/lib/types/knowledge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { useSessionExpiryRedirect } from "@/lib/api/use-session-expiry-redirect";

export default function KnowledgeUploadPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [file, setFile] = useState<File | null>(null);
  // Default to "published" so the uploaded document is immediately visible in
  // the Knowledge Base list (which filters by status=published). Authors can
  // still switch to Draft below when they want to stage a document.
  const [form, setForm] = useState({ title: "", description: "", type: "policy", categoryId: "", tags: "", status: "published" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getDocumentCategories();
        if (active) {
          setCategories(data);
        }
      } catch (err) {
        if (active) {
          setCategoryError("We couldn't load document categories. You can still upload without a category.");
          setLastError(err);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useSessionExpiryRedirect(lastError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastError(null);
    if (!file) return;
    setLoading(true);
    try {
      await uploadDocument(file, {
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        categoryId: form.categoryId || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : undefined,
        status: form.status,
      });
      router.push("/dashboard/knowledge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setLastError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            title="Upload Document"
            description="Add a new policy, SOP, or guideline to the knowledge base."
            actions={(
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/knowledge")}
              >
                ← Knowledge Base
              </Button>
            )}
          />
        </Card>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field
              label="File *"
              hint="Accepted formats: PDF, Word, Excel, PowerPoint."
            >
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </Field>

            <Field label="Title *">
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="e.g. Workplace Safety Policy"
                required
              />
            </Field>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                rows={4}
                placeholder="A short summary to help teammates find this document."
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Type">
                <Select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value })
                  }
                >
                  <option value="policy">Policy</option>
                  <option value="sop">SOP</option>
                  <option value="manual">Manual</option>
                  <option value="procedure">Procedure</option>
                  <option value="guideline">Guideline</option>
                </Select>
              </Field>

              <Field label="Category">
                <Select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoryId: e.target.value,
                    })
                  }
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Tags (comma-separated)">
              <Input
                value={form.tags}
                onChange={(e) =>
                  setForm({ ...form, tags: e.target.value })
                }
                placeholder="safety, operations, compliance"
              />
            </Field>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </Field>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={!file || !form.title.trim() || loading}
                className="min-w-[180px]"
              >
                {loading ? "Uploading..." : "Upload Document"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/dashboard/knowledge")}
              >
                Cancel
              </Button>
            </div>

            {categoryError && (
              <Notice variant="warning">{categoryError}</Notice>
            )}
            {error && <Notice variant="danger">{error}</Notice>}
          </form>
        </Card>
      </div>
    </main>
  );
}
