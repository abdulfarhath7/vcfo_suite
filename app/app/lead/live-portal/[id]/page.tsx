import { Suspense } from 'react';
import { pageMetadata } from '@/lib/shell/page-metadata';
import LivePortalView from '@/views/live-portal/LivePortalView';

export const metadata = pageMetadata('Live portal', 'The live portal session on the server browser');

export default function Page() {
  return (
    <Suspense>
      <LivePortalView />
    </Suspense>
  );
}
