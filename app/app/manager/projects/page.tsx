import { ClientsPage } from '@/components/console/pages/clients/ClientsPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Clients", "Every client in your book");

export default function Page() {
  return <ClientsPage />;
}
