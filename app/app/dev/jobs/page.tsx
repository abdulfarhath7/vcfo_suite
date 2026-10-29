import DevJobs from '@/views/dev/DevJobs';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Jobs', 'Inngest functions and their recent runs');

export default function Page() {
  return <DevJobs />;
}
