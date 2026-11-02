import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientCompliancesTaskRoute } from '@/components/client-portal/pages/compliances';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Task', 'One non-statutory task shared with the client');

/** A non-statutory task shared with the client — the Filings section owns it in the portal. */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'filings' }}
      legacy={
        <Suspense fallback={null}>
          <ClientCompliancesTaskRoute />
        </Suspense>
      }
    />
  );
}
