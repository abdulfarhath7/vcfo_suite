import { AnalyticsPage } from '@/components/console/pages/insight/AnalyticsPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Analytics", "How your book is doing over time");

export default function Page() {
  return <AnalyticsPage />;
}
