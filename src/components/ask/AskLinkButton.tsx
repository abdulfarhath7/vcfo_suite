'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AnswerLink } from '@/data/ask/schema';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { resolveHref } from '@/lib/ask/resolve-href';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';
import { useAskLayoutMode } from './use-ask-layout';

/**
 * A go-there link (§7.7). Navigates only. At ≥ 1440 px the panel stays open
 * beside the page; below that it closes and leaves a "Back to Ask VCFO" pill.
 */
export function AskLinkButton({ link }: { link: AnswerLink }) {
  const ask = useAskOptional();
  const staffBase = useStaffBasePath();
  const mode = useAskLayoutMode();
  if (!ask) return null;
  return (
    <Link
      href={resolveHref(link.dest, staffBase)}
      onClick={() => {
        if (mode !== 'push') {
          ask.setOpen(false);
          ask.setBackPill(true);
        }
      }}
      className={cn(
        'inline-flex min-h-[40px] items-center gap-1 rounded-[var(--radius-md)] px-3 text-[12.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        link.primary
          ? 'border border-primary/50 text-primary hover:bg-primary-light'
          : 'border border-border text-foreground hover:bg-muted',
      )}
    >
      {link.label}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
