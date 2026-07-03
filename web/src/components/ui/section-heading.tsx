import { cn } from '@/lib/utils';

export function SectionHeading({
  badge,
  title,
  description,
  actions,
  className,
  divider = true,
}: {
  badge?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-5 md:flex-row md:items-end md:justify-between',
        divider && 'border-b border-[var(--color-border)]',
        className,
      )}
    >
      <div className="min-w-0">
        {badge ? <div className="mb-3">{badge}</div> : null}
        <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-foreground)] md:text-[1.6rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
