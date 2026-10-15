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

/** Quiet header link, same weight as the compliance register. */
export const clientCardActionClass =
  'text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline';

/**
 * One section shell for the client home.
 *
 * Header and body use the same inset as Urgent pending: 16px padding, a
 * 15px sentence-case title, and a hairline under the header.
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
        <div className="flex min-w-0 items-center gap-3 border-b border-foreground/10 px-4 py-3">
          {Icon ? (
            <span
              className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', CHIP[tone])}
            >
              <Icon className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
          {title ? (
            <h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">{title}</h2>
          ) : null}
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  );
}
