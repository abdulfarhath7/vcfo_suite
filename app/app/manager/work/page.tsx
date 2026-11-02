import { WorkPage } from '@/components/console/pages/work/WorkPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("My work", "Your to-dos, timeline and calendar");

export default function Page() {
  return <WorkPage />;
}
