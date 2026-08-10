import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { BoardResolutionDoc } from '@/lib/board-resolution';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { isEngagementRouteParam } from '@/lib/slug';
import {
  assertEngagementAccess,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { getBoardResolutionByEngagementId } from '@/db/repositories/board-resolution';

export async function assertEngagementBoardResolutionAccess(
  ctx: AuthContext,
  appEngagementId: string,
): Promise<{
  dbId: string;
  row?: EngagementDbRow;
  forbidden?: boolean;
  notFound?: boolean;
}> {
  if (!isEngagementRouteParam(appEngagementId)) {
    return { dbId: engagementDbId(appEngagementId), notFound: true };
  }

  const access = await assertEngagementAccess(ctx, appEngagementId);
  if (!access.ok) {
    if ('notFound' in access) {
      return { dbId: access.dbId, notFound: true };
    }
    return { dbId: access.dbId, forbidden: true };
  }
  return { dbId: access.dbId, row: access.row };
}

export async function fetchBoardResolutionForApi(
  ctx: AuthContext,
  dbEngagementId: string,
): Promise<BoardResolutionDoc | null> {
  return getBoardResolutionByEngagementId(ctx, dbEngagementId);
}
