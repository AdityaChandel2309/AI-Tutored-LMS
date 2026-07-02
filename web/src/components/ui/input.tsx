import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps =
  React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-11 w-full rounded-[calc(var(--radius)-4px)] border border-[var(--color-border)] bg-white/90 px-4 py-2 text-sm text-[var(--color-foreground)] shadow-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color:var(--color-primary-soft)]',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
