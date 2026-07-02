import { cn } from '@/lib/utils';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--color-border)] bg-[color:color-mix(in_oklch,var(--color-card)_88%,white)] p-6 text-[var(--color-card-foreground)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm',
        className
      )}
      {...props}
    />
  );
}
