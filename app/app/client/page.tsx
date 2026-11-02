import { ClientRoute } from '@/components/portal/Intent';
import { LegacyOverview } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Client portal", "Client home");

/** The client portal: one page of sections, opened at Home. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'home' }} legacy={<LegacyOverview />} />;
}
