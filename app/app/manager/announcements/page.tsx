import { AnnouncementsPage } from '@/components/console/pages/updates/AnnouncementsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Announcements", "Firm news and approved official updates");

export default function Page() {
  return <AnnouncementsPage />;
}
