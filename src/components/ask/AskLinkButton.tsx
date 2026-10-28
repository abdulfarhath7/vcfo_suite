'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AnswerLink } from '@/data/ask/schema';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { resolveHref } from '@/lib/ask/resolve-href';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';
import { useAskLayoutMode } from './use-ask-layout';

/**
 * A go-there link (§7.7). Navigates only. At ≥ 1440 px the panel stays open
 * beside the page; below that it closes and leaves a "Back to Ask VCFO" pill.
 * The primary link is the blurple main button; the rest are white secondary buttons.
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
      className={cn(buttonVariants({ variant: link.primary ? 'default' : 'secondary', size: 'sm' }))}
    >
      {link.label}
      <ArrowUpRight aria-hidden />
    </Link>
  );
}
