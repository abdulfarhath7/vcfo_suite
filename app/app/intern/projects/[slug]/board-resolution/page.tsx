import { BoardResolutionPage } from '@/components/console/pages/clients/BoardResolutionPage';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Draft and finalise the board resolution');

export default function Page() {
  return <BoardResolutionPage />;
}
