import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  /** Kept for callers; the card header no longer paints a rail. */
  accent?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** Extra block inside the header card (compose, filters). */
  footer?: ReactNode;
  forceBack?: boolean;
  backFallbackHref?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  footer,
  forceBack,
  backFallbackHref,
}: Props) {
  return (
    <header
      className={cn(
        'mb-5 overflow-hidden rounded-2xl border border-border/70 bg-panel shadow-[0_8px_28px_-22px_oklch(22%_0.04_260_/_0.45)] sm:mb-6',
      )}
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-5">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <PageBackButton className="-ml-1.5" force={forceBack} fallbackHref={backFallbackHref} />
            {Icon ? (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-light text-primary">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
            ) : null}
            <h1 className="min-w-0 text-[1.45rem] font-semibold leading-none tracking-tight text-ink sm:text-[1.65rem]">
              {title}
            </h1>
          </div>
          {subtitle ? (
            <div className="prose-narrow mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 [&_a]:min-h-10 [&_button]:min-h-10 [&_button]:rounded-xl">
            {actions}
          </div>
        ) : null}
      </div>
      {footer ? <div className="border-t border-border/70 bg-raised/20 px-5 py-4 sm:px-6">{footer}</div> : null}
    </header>
  );
}
