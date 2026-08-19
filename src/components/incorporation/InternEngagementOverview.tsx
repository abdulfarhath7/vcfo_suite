'use client';

import type { ReactNode } from 'react';
import { ProgressEmailCcSection } from '@/components/incorporation/ProgressEmailCcSection';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { cn } from '@/lib/utils';
import styles from './intern-engagement-overview.module.css';

/** Intern project overview chrome — company name + CC, then phase list. */
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
      <header className={cn('surface', styles.header)}>
        <div className={styles.titleCluster}>
          <PageBackButton className="-ml-1.5" />
          <h1 className={cn('serif', styles.title)}>{companyName}</h1>
        </div>
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
