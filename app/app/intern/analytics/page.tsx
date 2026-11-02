import { AnalyticsPage } from '@/components/console/pages/insight/AnalyticsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Analytics", "How your clients are doing over time");

export default function Page() {
  return <AnalyticsPage />;
}
