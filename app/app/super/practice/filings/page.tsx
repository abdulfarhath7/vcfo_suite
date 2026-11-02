import { Suspense } from 'react';
import { SuperFilingsPage } from '@/views/compliances/CompliancePages';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Filings', 'The filing register across every client');

/** Practice · Filings: the register with the All, Statutory and Non-statutory filter (F-1 to F-3). */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading filings…</div>}>
      <SuperFilingsPage />
    </Suspense>
  );
}
