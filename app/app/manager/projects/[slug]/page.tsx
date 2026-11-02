import { ClientOverviewPage } from '@/components/console/pages/clients/ClientOverviewPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Client", "One client: phases, steps, timeline and contacts");

export default function Page() {
  return <ClientOverviewPage />;
}
