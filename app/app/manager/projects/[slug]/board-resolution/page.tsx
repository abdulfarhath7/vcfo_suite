import BoardResolutionEditor from '@/views/intern/BoardResolutionEditor';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Edit board resolution');

/**
 * The board resolution editor for this shell (S-556, S-557, P-112). The shell layout's role guard
 * admits the page; every read and write goes through `/api/engagements/:id/board-resolution/*`,
 * which scopes the engagement by role through the repository.
 */
export default function Page() {
  return <BoardResolutionEditor />;
}
