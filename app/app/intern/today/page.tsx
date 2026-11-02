import { LeadTodayPage } from '@/components/console/pages/lead/LeadTodayPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Today", "Your desk today: what is due, what is late and who is waiting");

export default function Page() {
  return <LeadTodayPage />;
}
