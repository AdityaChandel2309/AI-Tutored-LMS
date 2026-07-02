"use client";

import { Suspense, use } from "react";
import { CourseBuilderWizard } from "@/components/course-builder/course-builder-wizard";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export default function CourseEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen px-6 py-10">
          <div className="mx-auto max-w-5xl">
            <Card className="p-8">
              <Notice>Loading course editor…</Notice>
            </Card>
          </div>
        </div>
      }
    >
      <CourseEditorInner params={params} />
    </Suspense>
  );
}

function CourseEditorInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CourseBuilderWizard courseId={id} />;
}
