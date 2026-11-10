import 'server-only';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { assistRunAttestations, documents } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { systemGetAssistCertifierMustDiffer } from '@/db/repositories/firm-settings';
import {
  AssistAgentAccessError,
  assertAssistAgentStaff,
  loadRun,
  toAttestationView,
  type RequestSeen,
} from '@/db/repositories/assist-agent-runs';
import { ATTESTABLE_STATES, certifierAllowed, missingAttestationChecks } from '@/lib/assist-agents/attestation';
import { ASSIST_AGENT_RUN_CLOSED, type AssistAgentRunStatus, type AssistAttestationChecks, type AssistAttestationView } from '@/lib/assist-agents/types';

/**
 * ASSIST RUN ATTESTATIONS — the certifier's due-diligence checks for one VCFO Assist run
 * (docs/specs/vcfo-assist-agents/SAFETY.md G17), table `assist_run_attestations`.
 *
 * Access: staff only (super admin, admin, manager, project lead), and only on a run whose
 * engagement the caller can reach (`assertEngagementAccess`); a run out of reach, or a run named
 * under another engagement's URL, is `not_found`. Any staff member in scope may be the certifier.
 * When the firm setting `assistCertifierMustDiffer` is on, the certifier must not be the user who
 * ran the agent (`certifier_must_differ`, 403). By default the same user is allowed.
 *
 * One attestation per run, written once (`already_attested`, 409 on a second one). It is refused
 * on a closed run (`run_closed`) and before the form is filled (`run_not_filled`), and when the
 * checks the form needs are not all confirmed (`attestation_incomplete`). Evidence document ids
 * must be live documents of the same engagement (`unknown_document`). Nothing here ticks a check:
 * every one comes from the request, which comes from a person's click.
 *
 * Retention: at least one year, like the runs (SAFETY.md G14). Nothing deletes an attestation.
 */

export interface RecordAttestationInput {
  checks: AssistAttestationChecks;
  evidenceDocumentIds: string[];
  note?: string;
}

export async function recordAttestation(
  ctx: AuthContext,
  engagementParam: string,
  runId: string,
  input: RecordAttestationInput,
  seen?: RequestSeen,
): Promise<AssistAttestationView> {
  assertAssistAgentStaff(ctx);
  const run = await loadRun(ctx, runId);
  if (!run) throw new AssistAgentAccessError('not_found', 404);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false || access.dbId !== run.engagementId) throw new AssistAgentAccessError('not_found', 404);
  if (ASSIST_AGENT_RUN_CLOSED.has(run.status as AssistAgentRunStatus)) throw new AssistAgentAccessError('run_closed', 409);
  if (!ATTESTABLE_STATES.has(run.state)) throw new AssistAgentAccessError('run_not_filled', 409);
  if (missingAttestationChecks(run.subAgent, input.checks).length > 0) throw new AssistAgentAccessError('attestation_incomplete', 400);

  const mustDiffer = await systemGetAssistCertifierMustDiffer();
  if (!certifierAllowed({ certifierId: ctx.userId, filerId: run.userId, mustDiffer })) {
    throw new AssistAgentAccessError('certifier_must_differ', 403);
  }

  const ids = [...new Set(input.evidenceDocumentIds)];
  if (ids.length > 0) {
    const found = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(inArray(documents.id, ids), eq(documents.engagementId, run.engagementId), isNull(documents.deletedAt)));
    if (found.length !== ids.length) throw new AssistAgentAccessError('unknown_document', 400);
  }

  const [existing] = await db.select({ id: assistRunAttestations.id }).from(assistRunAttestations).where(eq(assistRunAttestations.runId, run.id)).limit(1);
  if (existing) throw new AssistAgentAccessError('already_attested', 409);

  // Only the checks this form asks for are stored, so a stray Part B choice on a Part A run is dropped.
  const checks: AssistAttestationChecks = { fieldsCheckedAgainstRecords: true };
  if (run.subAgent === 'spice-b') {
    checks.registeredOffice = input.checks.registeredOffice;
    checks.subscriberSignatures = input.checks.subscriberSignatures;
  }

  const rows = await db
    .insert(assistRunAttestations)
    .values({
      runId: run.id,
      engagementId: run.engagementId,
      certifierId: ctx.userId,
      certifierName: ctx.name || null,
      certifierEmail: ctx.email || null,
      checks,
      evidenceDocumentIds: ids,
      note: input.note?.trim() || null,
      ip: seen?.ip && seen.ip !== 'unknown' ? seen.ip : null,
      forwardedFor: seen?.forwardedFor ? seen.forwardedFor.slice(0, 200) : null,
      userAgent: seen?.userAgent ? seen.userAgent.slice(0, 400) : null,
    })
    .onConflictDoNothing({ target: assistRunAttestations.runId })
    .returning();
  const saved = rows[0];
  // A second request that raced this one past the check above lands here.
  if (!saved) throw new AssistAgentAccessError('already_attested', 409);
  // The certifier's IP stays on the attestation, apart from the filer's IPs on the run, so the two
  // people's devices are never mixed up in the evidence.
  return toAttestationView(saved);
}
