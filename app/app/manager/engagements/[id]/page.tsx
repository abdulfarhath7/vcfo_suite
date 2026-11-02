import { EngagementRedirect } from '@/components/console/pages/clients/EngagementRedirect';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Client', 'Opening the client overview');

/** The old engagement link lands on the console's client overview (/app/manager/projects/<slug>). */
export default function Page() {
  return <EngagementRedirect />;
}
