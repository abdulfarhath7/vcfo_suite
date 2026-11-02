import SuperGrowth from '@/views/super/SuperGrowth';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Growth', 'New engagements and certificates over time');

export default function Page() {
  return <SuperGrowth />;
}
