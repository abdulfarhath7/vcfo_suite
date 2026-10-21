import AnnouncementsPage from '@/views/announcements/AnnouncementsPage';
import { ClientAnnouncementsEntry } from '@/components/client-portal/pages/team';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Announcements', 'Firm-wide news and official tax updates');

export default function Page() {
  return <ClientAnnouncementsEntry legacy={<AnnouncementsPage />} />;
}
