import { ClientRoute } from '@/components/portal/Intent';
import { LegacyIncorporation } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Incorporation", "Incorporation checklist");

/** Scrolls to Incorporation (?step= opens that step, ?phase= that phase). */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'incorporation' }} legacy={<LegacyIncorporation />} />;
}
