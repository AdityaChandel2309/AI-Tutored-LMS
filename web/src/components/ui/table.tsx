import { cn } from '@/lib/utils';

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto rounded-[calc(var(--radius)-4px)]">
      <table
        className={cn(
          'w-full caption-bottom text-sm',
          // Header row — sticky, muted background, uppercase micro-label
          '[&_thead]:bg-[var(--color-card-muted)]',
          '[&_thead_tr]:border-b [&_thead_tr]:border-[var(--color-border)]',
          '[&_thead_th]:px-4 [&_thead_th]:py-2.5 [&_thead_th]:text-left',
          '[&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wider',
          '[&_thead_th]:text-[var(--color-muted-foreground)]',
          // Body rows — subtle divide + hover, tabular numerics for consistency
          '[&_tbody_tr]:border-b [&_tbody_tr]:border-[var(--color-border)]',
          '[&_tbody_tr:last-child]:border-0',
          '[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-[var(--color-muted)]',
          '[&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td]:align-middle',
          '[&_tbody_td]:tabular-nums',
          className,
        )}
        {...props}
      />
    </div>
  );
}