import { ClientDocsPage } from '@/components/console/pages/clients/ClientDocsPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Documents", "The client document pack");

export default function Page() {
  return <ClientDocsPage />;
}
