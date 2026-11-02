import { NotificationsPage } from '@/components/console/pages/updates/NotificationsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Notifications", "Every notification for your account");

export default function Page() {
  return <NotificationsPage />;
}
