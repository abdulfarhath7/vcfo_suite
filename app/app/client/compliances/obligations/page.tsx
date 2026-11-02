import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientCompliancesObligationsRoute } from '@/components/client-portal/pages/compliances';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Obligations', 'Statutory obligations grouped by filing');

/**
 * Obligations (statutory and non-statutory, origin/main 30 Oct 2026). The Northwind portal
 * shows them from its Filings section until an Obligations section is built; a super admin
 * preview keeps the v7 page.
 */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'filings' }}
      legacy={
        <Suspense fallback={null}>
          <ClientCompliancesObligationsRoute />
        </Suspense>
      }
    />
  );
}
