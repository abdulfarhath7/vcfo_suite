import DevMessages from '@/views/dev/DevMessages';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Messages', 'Outbound email and WhatsApp delivery log');

export default function Page() {
  return <DevMessages />;
}
