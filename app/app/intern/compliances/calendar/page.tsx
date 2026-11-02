import { CalendarPage } from '@/components/console/pages/compliance/CalendarPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Compliance calendar", "Every filing across your clients");

export default function Page() {
  return <CalendarPage />;
}
