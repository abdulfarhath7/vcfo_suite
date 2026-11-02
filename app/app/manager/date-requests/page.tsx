import { DateRequestsPage } from '@/components/console/pages/approvals/DateRequestsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Date requests", "Date changes your project leads and clients asked for");

export default function Page() {
  return <DateRequestsPage />;
}
