import { Suspense } from 'react';
import { ClientRoute } from '@/components/portal/Intent';
import { ClientCompliancesTaskRoute } from '@/components/client-portal/pages/compliances';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Task', 'One non-statutory task shared with the client');

/** A non-statutory task shared with the client — the Obligations section opens its task view (the link every task bell carries). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  return (
    <ClientRoute
      intent={{ kind: 'task', id: decodeURIComponent(p.id) }}
      legacy={
        <Suspense fallback={null}>
          <ClientCompliancesTaskRoute />
        </Suspense>
      }
    />
  );
}
