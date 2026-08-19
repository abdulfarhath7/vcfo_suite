'use client';

import type { ReactNode } from 'react';
import { ProgressEmailCcSection } from '@/components/incorporation/ProgressEmailCcSection';
import { cn } from '@/lib/utils';
import styles from './intern-engagement-overview.module.css';

/** Intern project overview chrome — company name + CC, then phase map/list. */
export function InternEngagementOverview({
  companyName,
  engagementId,
  children,
}: {
  companyName: string;
  engagementId: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={cn('serif', styles.title)}>{companyName}</h1>
        <ProgressEmailCcSection
          engagementId={engagementId}
          variant="inline"
          className={styles.cc}
        />
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function InternOverviewSyncNotice({ children }: { children: ReactNode }) {
  return <div className={styles.sync}>{children}</div>;
}
