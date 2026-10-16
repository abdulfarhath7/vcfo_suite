import { IncorporationRoute } from '@/components/client-portal/pages/incorporation';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Incorporation', 'Incorporation checklist');

/** Client portal v7 landing. `?step=` (email links) and `?phase=` still deep-link. */
export default function Page() {
  return <IncorporationRoute />;
}
