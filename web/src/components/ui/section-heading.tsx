import { cn } from '@/lib/utils';

export function SectionHeading({
  badge,
  title,
  description,
  actions,
  className,
}: {
  badge?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <div>
        {badge ? <div className="mb-3">{badge}</div> : null}
        <h2 className="text-2xl font-semibold text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
