"use client";

// Project status pill. Colors are derived entirely from design tokens
// (--color-* families) rather than raw Tailwind palette utilities, and the
// rounded shape uses the radius utility — no hardcoded color system.
const STATUS_STYLES: Record<string, string> = {
  planning:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
  active:
    "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  on_hold:
    "bg-[color:color-mix(in_oklch,var(--color-danger-soft)_50%,var(--color-accent-soft))] text-[color:color-mix(in_oklch,var(--color-danger)_50%,var(--color-accent))]",
  completed:
    "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  cancelled:
    "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ??
        "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
