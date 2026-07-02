"use client";

export function ProgressBar({
  value,
  showLabel = true,
  size = "md",
}: {
  value: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const pct = Math.round(value * 100);
  const isComplete = pct === 100;
  const height = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)]">
          <span>Progress</span>
          <span className="font-medium tabular-nums">
            {pct}%
          </span>
        </div>
      )}
      <div
        className={`${height} w-full overflow-hidden rounded-full bg-[var(--color-muted)]`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: isComplete
              ? "var(--color-accent)"
              : "var(--color-primary)",
          }}
        />
      </div>
    </div>
  );
}
