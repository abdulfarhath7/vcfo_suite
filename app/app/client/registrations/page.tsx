import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientRegistrationsRoute } from '@/components/client-portal/pages/registrations';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registrations', 'Registrations of the company');

/** Scrolls to Registrations; a super admin preview keeps the v7 registrations page. */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'registrations' }}
      legacy={
        <Suspense fallback={null}>
          <ClientRegistrationsRoute />
        </Suspense>
      }
    />
  );
}
