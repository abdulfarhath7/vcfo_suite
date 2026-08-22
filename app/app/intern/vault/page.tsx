import DocumentVaultPage from '@/views/vault/DocumentVaultPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Document vault', 'Files across your assigned clients');

export default function Page() {
  return <DocumentVaultPage />;
}
