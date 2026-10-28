'use client';

import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { shouldShowShellBack } from '@/components/shell/shell-back';
import {
  normalizeShellTrailLabel,
  pageTitleRepeatsTrail,
} from '@/components/shell/shell-crumbs';
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
  /** Suppress the shell back chevron (full-page forms with their own exit). */
  hideBack?: boolean;
}

function labelsMatch(a: string, b: string): boolean {
  return normalizeShellTrailLabel(a) === normalizeShellTrailLabel(b);
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
  hideBack,
}: Props) {
  const pathname = usePathname();
  const repeatsTrail = pageTitleRepeatsTrail(title, pathname);
  const showTitle = !repeatsTrail;
  const showEyebrow = Boolean(
    eyebrow &&
      !labelsMatch(eyebrow, title) &&
      !pageTitleRepeatsTrail(eyebrow, pathname),
  );
  const showIcon = showTitle && Boolean(Icon);
  const showBack = !hideBack && (Boolean(forceBack) || shouldShowShellBack(pathname));
  const hasExtras = Boolean(subtitle || actions || footer || showEyebrow);

  const heading = showTitle ? (
    <h1 className="min-w-0 text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink sm:text-[28px] sm:leading-9">
      {title}
    </h1>
  ) : (
    <h1 className="sr-only">{title}</h1>
  );

  const backBtn = showBack ? (
    <PageBackButton className="-ml-1.5" force={forceBack} fallbackHref={backFallbackHref} />
  ) : null;

  if (!showTitle && !showBack && !hasExtras) {
    return heading;
  }

  if (!showTitle && !hasExtras) {
    return (
      <header className="mb-3 flex items-center">
        {heading}
        {backBtn}
      </header>
    );
  }

  if (!showTitle) {
    return (
      <header
        className={cn(
          'mb-5',
          footer && 'overflow-hidden rounded-md border-1.5 border-line bg-surface-raised sm:mb-6',
        )}
      >
        {heading}
        <div
          className={cn(
            'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
            footer ? 'px-5 py-3 sm:px-6' : 'mb-1',
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            {showBack ? (
              <PageBackButton
                className="-ml-1.5 mt-0.5"
                force={forceBack}
                fallbackHref={backFallbackHref}
              />
            ) : null}
            <div className="min-w-0">
              {showEyebrow ? (
                <p className="mb-0.5 text-[12px] font-medium text-ink-muted">
                  {eyebrow}
                </p>
              ) : null}
              {subtitle ? (
                <div className="prose-narrow text-[13px] leading-relaxed text-ink-muted">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 ">
              {actions}
            </div>
          ) : null}
        </div>
        {footer ? (
          <div className="border-t border-line-soft px-5 py-4 sm:px-6">{footer}</div>
        ) : null}
      </header>
    );
  }

  return (
    /* VCFO Spectrum (R-02, R-09): a plain white head on the canvas, no card or shadow. A
       footer block (compose, filters) still sits in a 1.5px-edged card under the title. */
    <header className={cn('mb-5 sm:mb-6')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {showEyebrow ? (
            <p className="mb-1 text-[12px] font-medium text-ink-muted">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            {backBtn}
            {showIcon && Icon ? (
              <span className="sr-only">
                <Icon aria-hidden />
              </span>
            ) : null}
            {heading}
          </div>
          {subtitle ? (
            <div className="prose-narrow mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 ">
            {actions}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4 rounded-md border-1.5 border-line bg-surface-raised px-5 py-4 sm:px-6">{footer}</div> : null}
    </header>
  );
}
