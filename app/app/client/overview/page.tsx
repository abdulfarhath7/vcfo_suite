import { ClientRoute } from '@/components/portal/Intent';
import { LegacyOverview } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Home", "Your India entity at a glance");

/** Home (top of the one-page portal). */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'home' }} legacy={<LegacyOverview />} />;
}
