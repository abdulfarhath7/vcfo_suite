import { ApprovalsPage } from '@/components/console/pages/approvals/ApprovalsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Approvals", "Steps and documents waiting for your approval");

export default function Page() {
  return <ApprovalsPage />;
}
