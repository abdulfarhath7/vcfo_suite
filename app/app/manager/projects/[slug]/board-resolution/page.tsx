import { BoardResolutionPage } from '@/components/console/pages/clients/BoardResolutionPage';
import { pageMetadata } from '@/lib/shell/page-metadata';

export const metadata = pageMetadata('Board resolution', 'Approve, release and receive the board resolution (NOC)');

/**
 * The board resolution (NOC) for the manager seat (S-556, S-557, P-112): the
 * console page wraps the live editor and the NOC staff cards. The shell layout's
 * role guard admits the page; every read and write goes through
 * `/api/engagements/:id/board-resolution/*`, which scopes the engagement by role
 * through the repository.
 */
export default function Page() {
  return <BoardResolutionPage />;
}
