import { VaultPage } from '@/components/console/pages/workspace/VaultPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Document vault", "Every client document in your book");

export default function Page() {
  return <VaultPage />;
}
