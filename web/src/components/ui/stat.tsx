import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'info';

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  default: { bg: 'var(--color-muted)', fg: 'var(--color-foreground)' },
  primary: { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary)' },
  accent: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent)' },
  success: { bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
};

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[calc(var(--radius)-2px)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all duration-200 hover:-translate-y-0.5',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-foreground)] tabular-nums">
            {value}
          </div>
          {hint ? (
            <div className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
              {hint}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: t.bg, color: t.fg }}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}
