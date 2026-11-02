import { ClientRoute } from '@/components/portal/Intent';
import { AskFullPage } from '@/components/ask/AskFullPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Ask VCFO', 'Ask VCFO, full page');

/** The portal carries Ask VCFO in its chat panel; this route lands on Home. A super admin preview gets the full page. */
export default function Page() {
  return <ClientRoute intent={{ kind: 'section', key: 'home' }} legacy={<AskFullPage />} />;
}
