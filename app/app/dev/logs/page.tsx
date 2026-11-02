import DevLogs from '@/views/dev/DevLogs';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Logs', 'Application log lines from CloudWatch');

export default function Page() {
  return <DevLogs />;
}
