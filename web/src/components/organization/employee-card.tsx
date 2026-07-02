"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { EmployeeProfile } from "@/lib/types/organization";

export function EmployeeCard({ employee }: { employee: EmployeeProfile }) {
  const name = [employee.user.firstName, employee.user.lastName].filter(Boolean).join(" ") || employee.user.email;

  return (
    <Link
      href={`/dashboard/employees/${employee.id}`}
      className="block rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_64px_-40px_rgba(15,23,42,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary)]">
          {(employee.user.firstName?.[0] || employee.user.email[0]).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--color-foreground)]">{name}</p>
          <p className="truncate text-sm text-[var(--color-muted-foreground)]">{employee.employeeCode}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {employee.department && (
          <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[var(--color-muted-foreground)]">
            {employee.department.name}
          </span>
        )}
        {employee.designation && (
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[var(--color-accent)]">
            {employee.designation.name}
          </span>
        )}
        {employee.location && (
          <span className="inline-flex items-center gap-1 text-[var(--color-muted-foreground)]">
            <MapPin aria-hidden className="h-3 w-3" />
            {employee.location}
          </span>
        )}
      </div>
    </Link>
  );
}
