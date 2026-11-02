'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { shouldShowShellBack } from '@/components/shell/shell-back';

/**
 * Plain white page head (VCFO Spectrum rule R-02, prototype Analytics and Audit): a 28px
 * weight-500 title, one muted meta line and the page's controls on the right. No card, band
 * or icon tile. Sidebar pages (Approvals) have no back chevron (R-09); a page below a sidebar
 * page passes `back` to show the shell back chevron where `PageHeader` would show it.
 */
export function PlainPageHead({
  title,
  meta,
  actions,
  back = false,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Show the back chevron. Off by default: R-09 forbids it on sidebar pages. */
  back?: boolean;
}) {
  const pathname = usePathname();
  const showBack = back && shouldShowShellBack(pathname);
  return (
    <header className="mb-5 flex flex-wrap items-center gap-3">
      {showBack ? <PageBackButton className="-ml-1.5" /> : null}
      <div className="min-w-0 flex-[1_1_240px]">
        <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">{title}</h1>
        {meta ? <p className="text-[13.5px] text-ink-muted">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
