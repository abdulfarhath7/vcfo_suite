import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { checklist } from '@/data/checklist';
import { getDocPackInputs } from '@/db/repositories/doc-pack';
import { getNocState } from '@/db/repositories/board-resolution-noc';
import { deriveChecklistDisplayStatus } from '@/lib/checklist/checklist-display-status';
import { boardResolutionProgressFromDoc } from '@/lib/client/client-progress-board';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import type { NocState } from '@/lib/noc/state';
import {
  deriveSpiceAttachments,
  type SpiceAttachmentList,
  type SpiceNocFacts,
} from '@/lib/spice-attachments/derive';

/**
 * SPICE+ ATTACHMENTS REPOSITORY — read only (spec T6 of the Board resolution (NOC) page).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   intern, manager, admin, super admin — the engagements `assertEngagementAccess` admits
 *     (through `getDocPackInputs`): a lead's own or member projects, a manager's own or
 *     co-managed projects, the firm for admin and super admin.
 *   client, developer — never (403). The list shows firm working documents.
 *
 * No table of its own: the list is derived from `checklist_state`, the board resolution row
 * and the NOC state (`src/lib/spice-attachments/derive.ts`). Nothing here writes.
 */

const STAFF = new Set(['intern', 'manager', 'admin', 'super_admin']);

export type SpiceAttachmentsAccess =
  | { ok: true; list: SpiceAttachmentList }
  | { ok: false; status: 403 | 404; error: 'forbidden' | 'not_found' };

/** The NOC facts the list reads. Exported for the test. */
export function nocFacts(noc: NocState | null): SpiceNocFacts | null {
  if (!noc) return null;
  const done = (key: string) => noc.track.some((s) => s.key === key && s.done);
  return {
    drafted: done('drafted') || done('released'),
    signed: done('signed'),
    accepted: noc.accepted,
    vaultDocumentId: noc.staff?.vaultDocumentId ?? null,
  };
}

export async function getSpiceAttachments(ctx: AuthContext, engagementParam: string): Promise<SpiceAttachmentsAccess> {
  if (!STAFF.has(ctx.role)) return { ok: false, status: 403, error: 'forbidden' };
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) return { ok: false, status: access.status, error: access.error };
  const { inputs } = access;

  const noc = await getNocState(ctx, inputs.dbId).catch(() => null);
  const docPack = (() => {
    try {
      return evaluateDocPack({ state: inputs.checklistState, brRow: inputs.brRow, engagement: inputs.engagement });
    } catch {
      return null;
    }
  })();
  const br = boardResolutionProgressFromDoc(inputs.brRow);
  const statusById = new Map(
    checklist
      .filter((it) => it.bucket === 'pre-inc')
      .map((it) => [it.id, deriveChecklistDisplayStatus(it.id, it, inputs.checklistState[it.id], br)] as const),
  );

  return {
    ok: true,
    list: deriveSpiceAttachments({
      stepStatus: (id) => statusById.get(id),
      docPack,
      noc: nocFacts(noc),
    }),
  };
}
