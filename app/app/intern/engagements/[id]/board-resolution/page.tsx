import BoardResolutionEditor from '@/views/intern/BoardResolutionEditor';
import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Edit board resolution');

export default function Page() {
  return <BoardResolutionEditor />;
}
