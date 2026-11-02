import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientRegistrationRoute } from '@/components/client-portal/pages/registrations';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Registration', 'One registration of the company');

/** One registration: the portal's Registrations section owns the record (the id is the step slug). */
export default function Page() {
  return (
    <ClientRoute
      intent={{ kind: 'section', key: 'registrations' }}
      legacy={
        <Suspense fallback={null}>
          <ClientRegistrationRoute />
        </Suspense>
      }
    />
  );
}
