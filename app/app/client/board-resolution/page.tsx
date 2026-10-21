import { BoardRoute } from '@/components/client-portal/pages/incorporation';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Board resolution documents');

export default function Page() {
  return <BoardRoute />;
}
