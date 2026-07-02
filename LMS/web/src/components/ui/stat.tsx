import { cn } from '@/lib/utils';

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] bg-white/75 p-4 shadow-sm',
        className,
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold text-slate-950">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-sm text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
