import DevOverview from '@/views/dev/DevOverview';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Developer console', 'Services, jobs, messages and deploys at a glance');

export default function Page() {
  return <DevOverview />;
}
