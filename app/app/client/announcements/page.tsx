import { ClientRoute } from '@/components/portal/Intent';
import AnnouncementsPage from '@/views/announcements/AnnouncementsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Announcements", "Firm-wide news and official tax updates");

/** Opens the Announcements card from the top bar. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'anns' }} legacy={<AnnouncementsPage />} />;
}
