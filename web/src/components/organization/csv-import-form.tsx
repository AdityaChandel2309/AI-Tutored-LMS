"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useImportEmployeesCsv } from "@/lib/api/employees";
import type { CsvImportResult } from "@/lib/types/organization";

export function CsvImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const importCsv = useImportEmployeesCsv();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setResult(null);
    try {
      const data = await importCsv.mutateAsync(file);
      setResult(data);
    } catch (err) {
      setResult({ imported: 0, errors: [(err as Error).message] });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full rounded-[calc(var(--radius)-4px)] border border-[var(--color-border)] p-2 text-sm text-[var(--color-foreground)]"
        />
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Required columns: employee_code, user_email. Optional: department_code, designation, location, phone, date_of_joining
        </p>
      </div>
      <Button type="submit" disabled={!file || importCsv.isPending}>
        <Upload aria-hidden className="h-4 w-4" />
        {importCsv.isPending ? "Importing…" : "Import"}
      </Button>
      {result && (
        <div className="space-y-2">
          <Notice variant={result.errors.length > 0 ? "warning" : "success"}>
            <span className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              Imported: {result.imported}
            </span>
          </Notice>
          {result.errors.length > 0 && (
            <Notice variant="danger">
              <p className="inline-flex items-center gap-2 font-medium">
                <TriangleAlert aria-hidden className="h-4 w-4" />
                Errors ({result.errors.length})
              </p>
              <ul className="ml-4 mt-1 list-disc text-xs">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>
      )}
    </form>
  );
}
