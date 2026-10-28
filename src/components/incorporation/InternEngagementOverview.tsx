'use client';

import type { ReactNode } from 'react';
import { ProgressEmailCcSection } from '@/components/incorporation/ProgressEmailCcSection';
import { RecordTile } from '@/components/incorporation/RecordHead';
import styles from './intern-engagement-overview.module.css';

/**
 * Intern project overview chrome — company name + CC, then phase list.
 *
 * VCFO Spectrum (C-0108): a plain record head with no grey band and no back link (R-09): the
 * company tile, the 28px name, the stage chip, the client email and the CC control, then the
 * record's numbers line.
 */
export function InternEngagementOverview({
  companyName,
  clientEmail,
  engagementId,
  badge,
  stats,
  children,
}: {
  companyName: string;
  /** Portal client's login email; absent on legacy rows without a linked client user. */
  clientEmail?: string | null;
  engagementId: string;
  /** Chip after the name, such as the stage. */
  badge?: ReactNode;
  /** The numbers line under the head (step, now). */
  stats?: ReactNode;
  children: ReactNode;
}) {
  const email = clientEmail?.trim();
  return (
    <div className={styles.page}>
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
          <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">
            <RecordTile name={companyName} />
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">{companyName}</h1>
                {badge}
              </div>
              {email ? (
                <p className="text-[13.5px] text-ink-muted">
                  <a href={`mailto:${email}`} className="hover:text-ink hover:underline" title={`Email ${companyName}`}>
                    {email}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
          <ProgressEmailCcSection engagementId={engagementId} variant="inline" className={styles.cc} />
        </div>
        {stats}
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function InternOverviewSyncNotice({ children }: { children: ReactNode }) {
  return <div className={styles.sync}>{children}</div>;
}
