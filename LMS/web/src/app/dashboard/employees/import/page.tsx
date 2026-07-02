"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { CsvImportForm } from "@/components/organization/csv-import-form";

export default function EmployeeImportPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(246,248,255,0.96),rgba(255,255,255,0.9))]">
          <SectionHeading
            badge={<Badge variant="neutral">People</Badge>}
            title="Import Employees"
            description="Upload a CSV to add or update employee records in bulk."
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/employees")}
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Directory
              </Button>
            }
          />
        </Card>
        <Card>
          <CsvImportForm />
        </Card>
      </div>
    </main>
  );
}
