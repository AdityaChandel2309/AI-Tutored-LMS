"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useDocuments, useDocumentCategories, getDownloadUrl } from "@/lib/api/knowledge";
import type { Document } from "@/lib/types/knowledge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonCard } from "@/components/ui/skeleton";

const DOC_TYPES = ["sop", "policy", "manual", "procedure", "guideline"];

// MIME type → lucide icon (replaces the previous emoji map). Word/PDF docs use
// a document icon, spreadsheets use a sheet icon, everything else a generic file.
const MIME_ICONS: Record<string, LucideIcon> = {
  "application/pdf": FileText,
  "application/msword": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/vnd.ms-excel": FileSpreadsheet,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
};

export default function KnowledgePage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const categories = useDocumentCategories();
  const documents = useDocuments({
    search: search || undefined,
    categoryId: categoryId || undefined,
    type: typeFilter || undefined,
    status: "published",
    page,
  });

  const total = documents.data?.total ?? 0;

  async function handleDownload(doc: Document) {
    const { url } = await getDownloadUrl(doc.id);
    window.open(url, "_blank");
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklch,var(--color-primary-soft)_55%,var(--color-card)),var(--color-card))]">
          <SectionHeading
            title="Knowledge Base"
            description="Browse company policies, SOPs, procedures, and operational guidelines."
            actions={
              <Button
                size="sm"
                onClick={() => router.push("/dashboard/knowledge/upload")}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Upload Document
              </Button>
            }
          />
        </Card>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="min-w-[200px] flex-1"
          />
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toUpperCase()}
              </option>
            ))}
          </Select>
        </div>

        <AsyncBoundary
          query={documents}
          skeleton={
            <div className="grid gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          }
          empty={
            <EmptyState
              title="No documents found"
              description="Try adjusting your search or filters, or upload a new document."
            />
          }
          errorMessage="We couldn't load the knowledge base. Please try again."
        >
          {(data) => {
            // `data` is the DocumentListResponse. An empty `items` list still
            // renders the EmptyState below (AsyncBoundary only treats null/[]
            // as empty, and this is an object), so guard it explicitly.
            if (data.items.length === 0) {
              return (
                <EmptyState
                  title="No documents found"
                  description="Try adjusting your search or filters, or upload a new document."
                />
              );
            }

            return (
              <>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {data.total} document{data.total !== 1 ? "s" : ""}
                </p>

                <div className="grid gap-3">
                  {data.items.map((doc) => {
                    const Icon = MIME_ICONS[doc.mimeType] ?? FileIcon;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-shadow hover:shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]"
                      >
                        <Link
                          href={`/dashboard/knowledge/${doc.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-[calc(var(--radius)-6px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
                        >
                          <Icon className="h-7 w-7 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--color-foreground)]">{doc.title}</p>
                            <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]">
                              <span className="rounded-full bg-[var(--color-muted)] px-1.5">{doc.type}</span>
                              {doc.category && <span>{doc.category.name}</span>}
                              <span>v{doc.version}</span>
                              <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>
                            </div>
                          </div>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                        >
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {data.total > 20 && (
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Prev
                    </Button>
                    <span className="px-3 py-1 text-sm text-[var(--color-muted-foreground)]">Page {page}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * 20 >= total}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            );
          }}
        </AsyncBoundary>
      </div>
    </main>
  );
}
