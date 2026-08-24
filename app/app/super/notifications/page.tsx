import NotificationHistoryPage from '@/views/notifications/NotificationHistoryPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata(
  'Notification history',
  'Every notification for your account, including items cleared from the inbox',
);

export default function Page() {
  return <NotificationHistoryPage />;
}
