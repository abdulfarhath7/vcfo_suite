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
 * `.surface` with a sentence-case heading. Both the title and the icon are
 * optional: a card whose content names itself gets neither, which is how the
 * client home stops repeating each label twice and stops wearing an icon tile
 * on every header. Keeping this shared is why the change is one edit, not
 * twelve.
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
  /** Omit when the content names itself — a card should not explain what it is. */
  title?: string;
  /** Opt-in. Icons earn their place by aiding scanning, not as card ornament. */
  icon?: LucideIcon;
  tone?: ClientCardTone;
  /** Right-aligned link or control in the header row. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('surface h-fit min-w-0 overflow-hidden', className)}>
      {title || action ? (
        <div className="flex min-w-0 items-center gap-2 px-4 pt-3.5">
          {Icon ? (
            <span
              className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', CHIP[tone])}
            >
              <Icon className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
          {title ? (
            <h2 className="min-w-0 truncate text-[13px] font-semibold text-ink">{title}</h2>
          ) : null}
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('px-4 pb-4 pt-2.5', bodyClassName)}>{children}</div>
    </section>
  );
}
