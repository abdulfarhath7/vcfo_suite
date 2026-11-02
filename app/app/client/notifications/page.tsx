import { ClientRoute } from '@/components/portal/Intent';
import NotificationHistoryPage from '@/views/notifications/NotificationHistoryPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Notifications", "Every notification for your account");

/** Opens the Notifications card from the top bar. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'notes' }} legacy={<NotificationHistoryPage />} />;
}
