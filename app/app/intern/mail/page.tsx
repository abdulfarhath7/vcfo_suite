import { EmailPage } from '@/components/console/pages/workspace/EmailPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Email", "Write to clients and your team from your mailbox");

export default function Page() {
  return <EmailPage />;
}
