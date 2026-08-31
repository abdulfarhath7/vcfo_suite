'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ClientCardTone =
  | 'primary'
  | 'success'
  | 'sky'
  | 'teal'
  | 'violet'
  | 'cyan'
  | 'neutral';

/** Solid chip fills, same language as the lead dashboard's section headers. */
const CHIP: Record<ClientCardTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success text-white',
  sky: 'bg-accent-sky text-white',
  teal: 'bg-accent-teal text-white',
  violet: 'bg-accent-violet text-white',
  cyan: 'bg-accent-cyan text-white',
  neutral: 'bg-muted-foreground text-white',
};

/**
 * One section shell for the whole client dashboard.
 *
 * Deliberately identical in structure to the lead dashboard's cards
 * (`LeadSideRail`, `LeadPhaseProgress`, `LeadManagersCard`): `.surface`, a
 * solid 28px icon chip, and an extra-bold uppercase ink heading. Keeping the
 * two surfaces on one idiom is why this is a shared component rather than a
 * header repeated in twelve files.
 */
export function ClientCard({
  title,
  icon: Icon,
  tone = 'primary',
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon: LucideIcon;
  tone?: ClientCardTone;
  /** Right-aligned link or control in the header row. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('surface h-fit min-w-0 overflow-hidden', className)}>
      <div className="flex min-w-0 items-center gap-2.5 px-4 pt-3">
        <span
          className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', CHIP[tone])}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
          {title}
        </h2>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      <div className={cn('px-4 pb-3.5 pt-2.5', bodyClassName)}>{children}</div>
    </section>
  );
}
