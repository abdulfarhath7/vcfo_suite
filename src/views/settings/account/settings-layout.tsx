import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Layout pieces shared by the account settings cards: a section heading and a label / value row. */

export function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function SettingsRow({
  label,
  hint,
  last,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid gap-1 py-3 sm:grid-cols-[6.75rem_minmax(0,1fr)] sm:items-center sm:gap-4',
        !last && 'border-b border-line/60',
      )}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] text-ink-muted">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-ink-muted/80">{hint}</p> : null}
      </div>
      <div className="min-w-0 text-[13px] text-ink">{children}</div>
    </div>
  );
}
