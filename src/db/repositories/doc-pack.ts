import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import type { BoardResolutionDoc } from '@/lib/board-resolution';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { isEngagementRouteParam } from '@/lib/slug';
import { getBoardResolutionByEngagementId } from '@/db/repositories/board-resolution';
import {
  assertEngagementAccess,
  checklistStateFromRow,
  toAppEngagement,
} from '@/db/repositories/engagements';

/**
 * DOCUMENT PACK REPOSITORY — read-only inputs for `evaluateDocPack`.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   super_admin / admin — any engagement
 *   manager — engagements they own or co-manage (`assertEngagementAccess`)
 *   intern  — engagements they lead or are a member of
 *   client  — never. The pack shows firm working documents and board
 *             resolution state; clients see released files through the
 *             existing Pre-8 and board-resolution routes only.
 *
 * Nothing here writes: no checklist patch, no S3 upload, no audit (the routes
 * audit downloads themselves).
 */

export interface DocPackInputs {
  dbId: string;
  engagement: Engagement;
  checklistState: EngagementChecklistState;
  brRow: BoardResolutionDoc | null;
}

export type DocPackAccess =
  | { ok: true; inputs: DocPackInputs }
  | { ok: false; status: 403; error: 'forbidden' }
  | { ok: false; status: 404; error: 'not_found' };

export async function getDocPackInputs(
  ctx: AuthContext,
  engagementParam: string,
): Promise<DocPackAccess> {
  if (ctx.role === 'client') return { ok: false, status: 403, error: 'forbidden' };
  if (!isEngagementRouteParam(engagementParam)) {
    return { ok: false, status: 404, error: 'not_found' };
  }

  const access = await assertEngagementAccess(ctx, engagementParam);
  if (!access.ok) {
    return 'notFound' in access
      ? { ok: false, status: 404, error: 'not_found' }
      : { ok: false, status: 403, error: 'forbidden' };
  }

  const brRow = await getBoardResolutionByEngagementId(ctx, engagementDbId(access.dbId));
  return {
    ok: true,
    inputs: {
      dbId: access.dbId,
      engagement: toAppEngagement(access.row),
      checklistState: checklistStateFromRow(access.row),
      brRow,
    },
  };
}
