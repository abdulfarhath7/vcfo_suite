import { VaultPage } from '@/components/console/pages/workspace/VaultPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata("Document vault", "Every client document you can open");

export default function Page() {
  return <VaultPage />;
}
