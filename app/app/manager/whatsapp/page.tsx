import { WhatsAppPage } from '@/components/console/pages/workspace/WhatsAppPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('WhatsApp', 'Send a WhatsApp message from an approved template');

export default function Page() {
  return <WhatsAppPage />;
}
