import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { assistAgentRuns, assistRunAttestations, engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { assertEngagementAccess, listScopedEngagementIds } from '@/db/repositories/engagements';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import {
  ASSIST_AGENT_RUN_CLOSED,
  type AssistAttestationView,
  type AssistBlank,
  type AssistClientIp,
  type AssistDevice,
  type AssistDscSigner,
  type AssistHeal,
  type AssistRefusal,
  type AssistAgentRunStatus,
  type AssistAgentRunView,
} from '@/lib/assist-agents/types';

/**
 * ASSIST AGENT RUNS REPOSITORY — the VCFO Assist agents' run log (docs/specs/vcfo-assist-agents/PLAN.md),
 * table `assist_agent_runs`. Not `assist-runs.ts`, which serves the older "Start filing" table.
 *
 * Access (staff only; clients and developers get nothing, before any query):
 *   super admin and admin — every run;
 *   manager — runs on engagements they manage (the engagement scope);
 *   project lead (intern) — runs on engagements they lead.
 * One run is reached through its engagement (`assertEngagementAccess`). Only the person who
 * started a run, or an admin or manager in scope, may change it. A closed run (done, failed,
 * cancelled) takes no more changes. The AI counters are metered on the server by the resolver
 * (`addAgentRunAiUsage`), never written from the extension's PATCH.
 *
 * Evidence (SAFETY.md G14): the run keeps the Suite user's name and email as they were at the
 * start, the MCA login label, the DSC holders, the device and every client IP Suite saw on a write
 * call (`seen`). Retention: at least one year; nothing in the app deletes a run (see
 * `src/db/schema-assist.ts`).
 */

export class AssistAgentAccessError extends Error {
  constructor(
    message:
      | 'forbidden'
      | 'not_found'
      | 'run_closed'
      | 'already_decided'
      | 'already_attested'
      | 'run_not_filled'
      | 'certifier_must_differ'
      | 'attestation_incomplete'
      | 'unknown_document'
      | 'unknown_signer',
    readonly status: 403 | 404 | 409 | 400,
  ) {
    super(message);
    this.name = 'AssistAccessError';
  }
}

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);

export function assertAssistAgentStaff(ctx: AuthContext): void {
  if (!STAFF.has(ctx.role)) throw new AssistAgentAccessError('forbidden', 403);
}

type Row = typeof assistAgentRuns.$inferSelect;

type AttestationRow = typeof assistRunAttestations.$inferSelect;

const iso = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

export function toAttestationView(row: AttestationRow): AssistAttestationView {
  return {
    id: row.id,
    runId: row.runId,
    certifierId: row.certifierId,
    certifierName: row.certifierName,
    certifierEmail: row.certifierEmail,
    checks: row.checks,
    evidenceDocumentIds: row.evidenceDocumentIds ?? [],
    note: row.note,
    ip: row.ip,
    createdAt: iso(row.createdAt)!,
  };
}

function toView(
  row: Row,
  extra: { companyName?: string | null; userName?: string | null; attestation?: AttestationRow | null } = {},
): AssistAgentRunView {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    companyName: extra.companyName ?? null,
    userId: row.userId,
    userName: extra.userName ?? row.userName ?? null,
    agent: row.agent,
    subAgent: row.subAgent,
    recipeId: row.recipeId,
    recipeVersion: row.recipeVersion,
    status: row.status as AssistAgentRunStatus,
    state: row.state,
    fieldsTotal: row.fieldsTotal,
    fieldsFilled: row.fieldsFilled,
    heals: row.heals ?? [],
    refusals: row.refusals ?? [],
    aiCalls: row.aiCalls,
    aiTokens: row.aiTokens,
    srn: row.srn,
    error: row.error,
    blanks: row.blanks ?? [],
    evidence: {
      userName: row.userName ?? null,
      userEmail: row.userEmail ?? null,
      mcaLoginLabel: row.mcaLoginLabel ?? null,
      dscSigners: row.dscSigners ?? [],
      device: row.device ?? null,
      clientIps: row.clientIps ?? [],
    },
    attestation: extra.attestation ? toAttestationView(extra.attestation) : null,
    startedAt: iso(row.startedAt)!,
    finishedAt: iso(row.finishedAt),
    updatedAt: iso(row.updatedAt)!,
  };
}

export interface CreateAgentRunInput {
  agent: string;
  subAgent: string;
  recipeId: string;
  recipeVersion: string;
  fieldsTotal?: number;
  state?: string;
  mcaLoginLabel?: string;
  device?: { installId: string; userAgent: string };
  extensionVersion?: string;
}

/** What Suite saw of the request that touched a run (taken from the request headers by the route). */
export interface RequestSeen {
  ip: string;
  forwardedFor?: string | null;
  userAgent?: string | null;
}

/** Most distinct client IPs kept on one run; the oldest falls off past it. */
export const ASSIST_RUN_MAX_IPS = 20;

/** Adds one sighting of a client IP to the run's list: a known IP gets a new `lastAt` and count. */
export function noteClientIp(list: readonly AssistClientIp[] | null | undefined, seen: RequestSeen | undefined, at: Date): AssistClientIp[] {
  const current = [...(list ?? [])];
  if (!seen?.ip || seen.ip === 'unknown') return current;
  const when = at.toISOString();
  const forwardedFor = seen.forwardedFor ? seen.forwardedFor.slice(0, 200) : undefined;
  const hit = current.find((c) => c.ip === seen.ip);
  if (hit) {
    hit.lastAt = when;
    hit.calls += 1;
    if (forwardedFor) hit.forwardedFor = forwardedFor;
    return current;
  }
  current.push({ ip: seen.ip, ...(forwardedFor ? { forwardedFor } : {}), firstAt: when, lastAt: when, calls: 1 });
  return current.slice(-ASSIST_RUN_MAX_IPS);
}

function deviceOf(input: CreateAgentRunInput): AssistDevice | null {
  if (!input.device) return null;
  return { installId: input.device.installId, userAgent: input.device.userAgent, ...(input.extensionVersion ? { extensionVersion: input.extensionVersion } : {}) };
}

/** The attestation rows of these runs, by run id (one query). */
async function attestationsFor(runIds: string[]): Promise<Map<string, AttestationRow>> {
  if (runIds.length === 0) return new Map();
  const rows = await db.select().from(assistRunAttestations).where(inArray(assistRunAttestations.runId, runIds));
  return new Map(rows.map((r) => [r.runId, r]));
}

/** Starts a run on an engagement the caller can reach. Returns null when it cannot. */
export async function createAgentRun(
  ctx: AuthContext,
  engagementParam: string,
  input: CreateAgentRunInput,
  seen?: RequestSeen,
): Promise<AssistAgentRunView | null> {
  assertAssistAgentStaff(ctx);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false) return null;
  const [row] = await db
    .insert(assistAgentRuns)
    .values({
      engagementId: access.dbId,
      userId: ctx.userId,
      userName: ctx.name || null,
      userEmail: ctx.email || null,
      mcaLoginLabel: input.mcaLoginLabel ?? null,
      device: deviceOf(input),
      clientIps: noteClientIp([], seen, new Date()),
      agent: input.agent,
      subAgent: input.subAgent,
      recipeId: input.recipeId,
      recipeVersion: input.recipeVersion,
      status: 'running',
      state: input.state ?? 'READY',
      fieldsTotal: input.fieldsTotal ?? 0,
    })
    .returning();
  return row ? toView(row, { companyName: access.row.companyName, userName: ctx.name }) : null;
}

/** The raw row of one run the caller can reach, with the engagement access result. */
export async function loadRun(ctx: AuthContext, runId: string): Promise<Row | null> {
  assertAssistAgentStaff(ctx);
  const [row] = await db.select().from(assistAgentRuns).where(eq(assistAgentRuns.id, runId)).limit(1);
  if (!row) return null;
  const access = await assertEngagementAccess(ctx, row.engagementId);
  return access.ok ? row : null;
}

export async function getAgentRun(ctx: AuthContext, runId: string): Promise<AssistAgentRunView | null> {
  const row = await loadRun(ctx, runId);
  if (!row) return null;
  const attestations = await attestationsFor([row.id]);
  return toView(row, { attestation: attestations.get(row.id) ?? null });
}

/** Runs on one engagement, newest first. Null when the engagement is out of reach. */
export async function listAgentRuns(ctx: AuthContext, engagementParam: string, limit = 50): Promise<AssistAgentRunView[] | null> {
  assertAssistAgentStaff(ctx);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false) return null;
  const rows = await db
    .select({ run: assistAgentRuns, userName: profiles.name })
    .from(assistAgentRuns)
    .leftJoin(profiles, eq(profiles.id, assistAgentRuns.userId))
    .where(eq(assistAgentRuns.engagementId, access.dbId))
    .orderBy(desc(assistAgentRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  const attestations = await attestationsFor(rows.map((r) => r.run.id));
  return rows.map((r) => toView(r.run, { companyName: access.row.companyName, userName: r.userName, attestation: attestations.get(r.run.id) ?? null }));
}

/** The staff page: recent runs across every engagement in the caller's scope. */
export async function listRecentAgentRuns(ctx: AuthContext, limit = 50): Promise<AssistAgentRunView[]> {
  assertAssistAgentStaff(ctx);
  const scope = isFirmWideAdmin(ctx.role) ? 'all' : await listScopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];
  const rows = await db
    .select({ run: assistAgentRuns, companyName: engagements.companyName, userName: profiles.name })
    .from(assistAgentRuns)
    .innerJoin(engagements, eq(engagements.id, assistAgentRuns.engagementId))
    .leftJoin(profiles, eq(profiles.id, assistAgentRuns.userId))
    .where(scope === 'all' ? sql`${engagements.deletedAt} is null` : and(inArray(assistAgentRuns.engagementId, scope), sql`${engagements.deletedAt} is null`))
    .orderBy(desc(assistAgentRuns.startedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  const attestations = await attestationsFor(rows.map((r) => r.run.id));
  return rows.map((r) => toView(r.run, { companyName: r.companyName, userName: r.userName, attestation: attestations.get(r.run.id) ?? null }));
}

export interface UpdateAgentRunInput {
  status?: AssistAgentRunStatus;
  state?: string;
  fieldsTotal?: number;
  fieldsFilled?: number;
  heals?: AssistHeal[];
  refusals?: AssistRefusal[];
  srn?: string | null;
  error?: string | null;
  blanks?: AssistBlank[];
  /** Already resolved to names by the route (`resolveDscSigners`). */
  dscSigners?: AssistDscSigner[];
}

/**
 * Progress, the SRN and the finish. `engagementParam` must be the run's own engagement, so a run
 * id cannot be moved under another engagement's URL. Throws `AssistAgentAccessError` (404 or 409).
 * `engagementDbId` is the engagement's uuid however the URL named it (uuid, legacy id or slug).
 */
export async function updateAgentRun(
  ctx: AuthContext,
  engagementParam: string,
  runId: string,
  patch: UpdateAgentRunInput,
  seen?: RequestSeen,
): Promise<{ run: AssistAgentRunView; finished: boolean; engagementDbId: string }> {
  const row = await loadRun(ctx, runId);
  if (!row) throw new AssistAgentAccessError('not_found', 404);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false || access.dbId !== row.engagementId) throw new AssistAgentAccessError('not_found', 404);
  if (row.userId !== ctx.userId && !isAdminOrManager(ctx.role)) throw new AssistAgentAccessError('forbidden', 403);
  if (ASSIST_AGENT_RUN_CLOSED.has(row.status as AssistAgentRunStatus)) throw new AssistAgentAccessError('run_closed', 409);

  const finished = patch.status !== undefined && ASSIST_AGENT_RUN_CLOSED.has(patch.status);
  const now = new Date();
  const set: Partial<typeof assistAgentRuns.$inferInsert> = { updatedAt: now };
  if (seen) set.clientIps = noteClientIp(row.clientIps, seen, now);
  if (patch.blanks !== undefined) set.blanks = patch.blanks;
  if (patch.dscSigners !== undefined) set.dscSigners = patch.dscSigners;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.state !== undefined) set.state = patch.state;
  if (patch.fieldsTotal !== undefined) set.fieldsTotal = patch.fieldsTotal;
  if (patch.fieldsFilled !== undefined) set.fieldsFilled = patch.fieldsFilled;
  if (patch.heals !== undefined) set.heals = patch.heals;
  if (patch.refusals !== undefined) set.refusals = patch.refusals;
  if (patch.srn !== undefined) set.srn = patch.srn;
  if (patch.error !== undefined) set.error = patch.error;
  if (finished) set.finishedAt = now;

  const [saved] = await db
    .update(assistAgentRuns)
    .set(set)
    .where(and(eq(assistAgentRuns.id, row.id), eq(assistAgentRuns.engagementId, access.dbId)))
    .returning();
  if (!saved) throw new AssistAgentAccessError('not_found', 404);
  const attestations = await attestationsFor([saved.id]);
  return {
    run: toView(saved, { companyName: access.row.companyName, attestation: attestations.get(saved.id) ?? null }),
    finished,
    engagementDbId: access.dbId,
  };
}

/** Most model calls one run may make; past it the resolver answers with the label match only. */
export const ASSIST_AGENT_RUN_MAX_AI_CALLS = 10;

/**
 * Meters one resolver call on its run. Returns false when the run is out of reach, closed, or has
 * spent its calls; the caller then must not make the model call.
 */
export async function canSpendOnAgentRun(ctx: AuthContext, runId: string): Promise<boolean> {
  const row = await loadRun(ctx, runId);
  if (!row || ASSIST_AGENT_RUN_CLOSED.has(row.status as AssistAgentRunStatus)) return false;
  return row.aiCalls < ASSIST_AGENT_RUN_MAX_AI_CALLS;
}

export async function addAgentRunAiUsage(ctx: AuthContext, runId: string, usage: { calls: number; tokens: number }): Promise<void> {
  if (usage.calls <= 0 && usage.tokens <= 0) return;
  const row = await loadRun(ctx, runId);
  if (!row) return;
  await db
    .update(assistAgentRuns)
    .set({
      aiCalls: sql`${assistAgentRuns.aiCalls} + ${usage.calls}`,
      aiTokens: sql`${assistAgentRuns.aiTokens} + ${usage.tokens}`,
      updatedAt: new Date(),
    })
    .where(eq(assistAgentRuns.id, row.id));
}
