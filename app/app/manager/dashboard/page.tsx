import { TodayPage } from '@/components/console/pages/today/TodayPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Today", "Your book today: what needs you, what is late and what is next");

export default function Page() {
  return <TodayPage />;
}
