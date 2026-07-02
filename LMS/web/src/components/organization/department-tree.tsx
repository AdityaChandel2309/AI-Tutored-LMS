"use client";

import type { Department } from "@/lib/types/organization";

export function DepartmentTree({ departments }: { departments: Department[] }) {
  const roots = departments.filter((d) => !d.parentId);

  function renderNode(dept: Department) {
    const children = departments.filter((d) => d.parentId === dept.id);
    return (
      <li key={dept.id} className="ml-4 border-l border-[var(--color-border)] py-1 pl-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--color-foreground)]">{dept.name}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">({dept.code})</span>
          {dept._count && (
            <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 text-xs text-[var(--color-primary)]">
              {dept._count.employees} employees
            </span>
          )}
        </div>
        {children.length > 0 && <ul>{children.map(renderNode)}</ul>}
      </li>
    );
  }

  return <ul className="space-y-1">{roots.map(renderNode)}</ul>;
}
