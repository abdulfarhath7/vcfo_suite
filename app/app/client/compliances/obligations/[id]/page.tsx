import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientCompliancesObligationRoute } from '@/components/client-portal/pages/compliances';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Obligation', 'One statutory obligation and its periods');

/** One obligation (?filing=<id> opens that period) — the Filings section owns it in the portal. */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'filings' }}
      legacy={
        <Suspense fallback={null}>
          <ClientCompliancesObligationRoute />
        </Suspense>
      }
    />
  );
}
