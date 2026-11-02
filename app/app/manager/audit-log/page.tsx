import { AuditPage } from '@/components/console/pages/insight/AuditPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Audit log", "Who did what, and when");

export default function Page() {
  return <AuditPage />;
}
