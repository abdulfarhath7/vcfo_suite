'use client';

import { useObligationAbout, whyItAppliesLine } from '@/hooks/use-obligation-about';
import { TextCard } from '@/views/compliances/spectrum-parts';

/**
 * The three text cards of the staff obligation record's rail (G-04): About, Why it applies
 * (the library's reason, the stored applicability note and the due rule in one sentence)
 * and If filed late. They come from the scoped `GET /api/obligations/about`; while it
 * loads, or when the obligation has no texts, the cards are simply not drawn.
 */
export function ObligationAboutCards({ obligationId }: { obligationId: string }) {
  const q = useObligationAbout({ obligationId });
  const about = q.data;
  if (!about) return null;
  const why = whyItAppliesLine(about);
  return (
    <>
      {about.about ? (
        <TextCard title="About">
          <p>{about.about}</p>
        </TextCard>
      ) : null}
      {why || about.dueRule ? (
        <TextCard title="Why it applies">
          {why ? <p>{why}</p> : null}
          {about.dueRule ? <p className="text-ink-muted">{about.dueRule}</p> : null}
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
