import { ClientRoute } from '@/components/portal/Intent';
import { LegacyCalendar } from '@/components/portal/legacy';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Calendar", "Compliance calendar");

/** Scrolls to the compliance calendar (?filing=<id> opens that filing). */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'calendar' }} legacy={<LegacyCalendar />} />;
}
