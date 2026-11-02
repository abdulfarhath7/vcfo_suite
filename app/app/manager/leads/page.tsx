import { LeadsPage } from '@/components/console/pages/leads/LeadsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Project leads", "One project lead at a time: workload, to-dos and assignments");

export default function Page() {
  return <LeadsPage />;
}
