import BoardResolutionView from '@/views/client/BoardResolutionView';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Board resolution documents');

export default function Page() {
  return <BoardResolutionView />;
}
