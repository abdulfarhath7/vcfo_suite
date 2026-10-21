import { BoardRoute } from '@/components/client-portal/pages/incorporation';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Board resolution documents');

export default function Page() {
  return <BoardRoute />;
}
