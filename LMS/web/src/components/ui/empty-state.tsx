import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon aria-hidden className="h-10 w-10 text-[var(--color-muted-foreground)] mb-3" />
      <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)] max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
