import { pageMetadata } from '@/lib/page-metadata';
import ComposeMail from '@/views/staff/ComposeMail';

export const metadata = pageMetadata('Send email', 'Send from your Outlook mailbox');

export default function Page() {
  return <ComposeMail path="/app/manager/mail" />;
}
