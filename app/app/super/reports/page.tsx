import SuperReports from '@/views/super/SuperReports';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Reports', 'The monthly partner report from the firm records');

export default function Page() {
  return <SuperReports />;
}
