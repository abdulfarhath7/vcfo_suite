import { ClientRoute } from '@/components/portal/Intent';
import { LegacyFilings } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Filings", "Statutory filing register");

/** Scrolls to Filings (?filing=<id> opens that filing). */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'filings' }} legacy={<LegacyFilings />} />;
}
