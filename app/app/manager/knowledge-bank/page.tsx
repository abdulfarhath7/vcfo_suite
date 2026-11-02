import { KnowledgePage } from '@/components/console/pages/workspace/KnowledgePage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata("Knowledge bank", "The firm library");

export default function Page() {
  return <KnowledgePage />;
}
