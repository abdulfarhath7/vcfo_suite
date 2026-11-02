import DevAudit from '@/views/dev/DevAudit';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Audit', 'System and access events');

export default function Page() {
  return <DevAudit />;
}
