import AnnouncementsPage from '@/views/announcements/AnnouncementsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Announcements', 'Firm-wide news and official tax updates');

export default function Page() {
  return <AnnouncementsPage />;
}
