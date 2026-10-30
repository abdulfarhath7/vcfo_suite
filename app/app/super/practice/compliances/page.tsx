import { Suspense } from 'react';
import { SuperComplianceCalendarPage } from '@/views/compliances/CompliancePages';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Compliances', 'Statutory and non-statutory deadlines across every client');

/** Practice · Compliances: the calendar with the All, Statutory and Non-statutory filter (C-1 to C-4). */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading calendar…</div>}>
      <SuperComplianceCalendarPage />
    </Suspense>
  );
}
