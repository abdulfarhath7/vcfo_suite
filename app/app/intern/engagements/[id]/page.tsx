import { EngagementRedirect } from '@/components/console/pages/clients/EngagementRedirect';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Client", "Opening the client overview");

export default function Page() {
  return <EngagementRedirect />;
}
