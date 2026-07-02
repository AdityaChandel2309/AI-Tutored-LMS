import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex flex-col gap-2',
        className,
      )}
    >
      <span className="text-sm font-medium text-slate-800">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
