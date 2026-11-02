import { LeadTasksPage } from '@/components/console/pages/work/LeadTasksPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Tasks", "Your tasks across your clients");

export default function Page() {
  return <LeadTasksPage />;
}
