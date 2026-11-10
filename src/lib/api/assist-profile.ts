import 'server-only';

import { NextResponse } from 'next/server';

import { requireAnyRole, type AuthContext } from '@/auth/guards';
import { getDocPackInputs, type DocPackInputs } from '@/db/repositories/doc-pack';
import { buildAssistProfile } from '@/lib/assist-profile/build';
import type { AssistProfileResult } from '@/lib/assist-profile/types';
import { buildDocPackContext } from '@/lib/doc-pack/evaluate';

/**
 * Assist profile service — read-only. Resolves the engagement through the
 * doc-pack repository (same access rules: staff only, clients never, a lead
 * or manager only on engagements they are on) and maps it with the pure
 * builder. Nothing is written, cached or audited here.
 */

export type AssistProfileLoad = { ctx: AuthContext; inputs: DocPackInputs; result: AssistProfileResult };

/** Guard + repository + mapping in one step; returns a ready-to-send error response otherwise. */
export async function loadAssistProfile(
  engagementParam: string,
): Promise<{ ok: true; load: AssistProfileLoad } | { ok: false; response: NextResponse }> {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }),
    };
  }
  const built = await assistProfileFor(auth.ctx, engagementParam);
  if (built.ok === false) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: built.error }, { status: built.status }),
    };
  }
  return { ok: true, load: { ctx: auth.ctx, inputs: built.inputs, result: built.result } };
}

/**
 * The profile for a caller already through a staff guard (for example the VCFO Assist run route,
 * which resolves DSC signer references to names). Same repository and the same access rules.
 */
export async function assistProfileFor(
  ctx: AuthContext,
  engagementParam: string,
): Promise<{ ok: true; inputs: DocPackInputs; result: AssistProfileResult } | { ok: false; status: number; error: string }> {
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) return { ok: false, status: access.status, error: access.error };
  const { inputs } = access;
  const result = buildAssistProfile(
    buildDocPackContext({
      state: inputs.checklistState,
      brRow: inputs.brRow,
      engagement: inputs.engagement,
    }),
  );
  return { ok: true, inputs, result };
}
