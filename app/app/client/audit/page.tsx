import { ClientRoute } from '@/components/portal/Intent';
import AuditLog from '@/views/admin/AuditLog';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Audit", "Who did what, and when");

/** Scrolls to Audit. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'audit' }} legacy={<AuditLog />} />;
}
