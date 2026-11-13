import { Suspense } from 'react';
import { RegistrationsPage } from '@/views/compliances/CompliancePages';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registrations', 'Registration steps across every client');

/**
 * The same Registrations page as the lead, manager and admin (owner, 13 November 2026): the
 * registration boxes first, List and Grid beside them. Records open on the admin routes, which
 * a super admin may use. `SuperPracticeRegistrations` (the earlier read-only matrix) is no longer
 * routed; Grid shows the same clients-by-registration view.
 */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-muted">Loading registrations…</div>}>
      <RegistrationsPage shellBase="/app/super" pagePath="/app/super/practice/registrations" />
    </Suspense>
  );
}
