import DevConnections from '@/views/dev/DevConnections';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Connections', 'Configured services and linked Outlook mailboxes');

export default function Page() {
  return <DevConnections />;
}
