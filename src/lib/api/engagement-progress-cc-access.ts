import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { isEngagementRouteParam } from '@/lib/slug';
import { assertEngagementAccess } from '@/db/repositories/engagements';

/** Manager or assigned intern may read/update progress CC emails. */
export async function assertEngagementProgressCcAccess(
  ctx: AuthContext,
  appOrRouteEngagementId: string,
): Promise<{ dbId: string; forbidden?: boolean; notFound?: boolean }> {
  if (!isEngagementRouteParam(appOrRouteEngagementId)) {
    return { dbId: appOrRouteEngagementId, notFound: true };
  }

  if (ctx.role === 'client') {
    return { dbId: engagementDbId(appOrRouteEngagementId), forbidden: true };
  }

  const access = await assertEngagementAccess(ctx, appOrRouteEngagementId);
  if (!access.ok) {
    if ('notFound' in access) {
      return { dbId: access.dbId, notFound: true };
    }
    return { dbId: access.dbId, forbidden: true };
  }
  return { dbId: access.dbId };
}
