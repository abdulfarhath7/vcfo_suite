import { AskOpen } from '@/components/console/pages/updates/AskOpen';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Ask VCFO', 'Opening Ask VCFO');

/** The console answers in its own Ask VCFO panel; this address opens it. */
export default function Page() {
  return <AskOpen />;
}
