import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientCompliancesObligationsRoute } from '@/components/client-portal/pages/compliances';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Obligations', 'Statutory and non-statutory obligations');

/**
 * Obligations (statutory and non-statutory, origin/main 30 Oct 2026): the Northwind
 * portal's Obligations section. A super admin preview keeps the v7 page.
 */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'obligations' }}
      legacy={
        <Suspense fallback={null}>
          <ClientCompliancesObligationsRoute />
        </Suspense>
      }
    />
  );
}
