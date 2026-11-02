import { ClientsPage } from '@/components/console/pages/clients/ClientsPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Clients", "Every client you lead");

export default function Page() {
  return <ClientsPage />;
}
