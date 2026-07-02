import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const noticeVariants = cva(
  'rounded-[calc(var(--radius)-2px)] border px-4 py-3 text-sm shadow-sm',
  {
    variants: {
      variant: {
        neutral:
          'border-slate-200 bg-white/80 text-slate-700',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning:
          'border-amber-200 bg-amber-50 text-amber-800',
        danger:
          'border-rose-200 bg-rose-50 text-rose-800',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export function Notice({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof noticeVariants>) {
  return (
    <div
      className={cn(
        noticeVariants({ variant, className }),
      )}
      {...props}
    />
  );
}
