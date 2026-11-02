'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { useObligationAbout, whyItAppliesLine } from '@/hooks/use-obligation-about';
import { TextCard } from '@/views/compliances/spectrum-parts';

/**
 * The text cards of the staff obligation record's rail (G-04): About (with the way into the
 * knowledge bank, prototype "Read the SBC SOP"), Why it applies (the library's reason and the
 * stored applicability note), Due rule, and If filed late. They come from the scoped
 * `GET /api/obligations/about`; while it loads, or when the obligation has no texts, the
 * cards are simply not drawn.
 */
export function ObligationAboutCards({ obligationId, kbHref }: { obligationId: string; kbHref?: string }) {
  const q = useObligationAbout({ obligationId });
  const about = q.data;
  if (!about) return null;
  const why = whyItAppliesLine(about);
  return (
    <>
      {about.about || kbHref ? (
        <TextCard title="About">
          {about.about ? <p>{about.about}</p> : null}
          {kbHref ? (
            <Link href={kbHref} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline">
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
              Find the SOP in the knowledge bank
            </Link>
          ) : null}
        </TextCard>
      ) : null}
      {why ? (
        <TextCard title="Why it applies">
          <p>{why}</p>
        </TextCard>
      ) : null}
      {about.dueRule ? (
        <TextCard title="Due rule">
          <p>{about.dueRule}</p>
        </TextCard>
      ) : null}
      {about.ifLate ? (
        <TextCard title="If filed late">
          <p>{about.ifLate}</p>
        </TextCard>
      ) : null}
    </>
  );
}
