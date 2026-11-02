import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { registeredOfficeNocs } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { appEngagementId } from '@/lib/legacy-engagement-ids';
import { assertEngagementAccess, listScopedEngagementIds } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { coerceNocInput, type NocInput } from '@/lib/registered-office-noc/model';

/**
 * REGISTERED-OFFICE NOC REPOSITORY (New project → NOC, manager console).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * New table, no original RLS. Product rule, the documents default narrowed:
 *   admin / super_admin: every engagement — read and write
 *   manager: owned + co-managed engagements (`assertEngagementAccess`) — read and write
 *   intern (project lead): assigned engagements — read only
 *   client: none (the NOC reaches the client as a file request on the step)
 * Every function gates on `assertEngagementAccess` and then works only on the
 * id it approved, never the raw id the caller sent.
 */

export type NocStatus = 'generated' | 'sent' | 'signed';

export interface NocHistoryEntry {
  at: string;
  byName: string;
  text: string;
}

export interface RegisteredOfficeNocDto {
  engagementId: string;
  status: NocStatus;
  input: NocInput;
  fileName: string;
  generatedAt: string;
  sentAt: string | null;
  sentTo: string | null;
  signedAt: string | null;
  signedFileName: string | null;
  history: NocHistoryEntry[];
  updatedAt: string;
}

type NocRow = typeof registeredOfficeNocs.$inferSelect;

export class NocAccessError extends Error {
  constructor(
    message: string,
    readonly status: 403 | 404 | 409,
  ) {
    super(message);
  }
}

function coerceStatus(v: string): NocStatus {
  return v === 'sent' || v === 'signed' ? v : 'generated';
}

function coerceHistory(raw: unknown): NocHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is Record<string, unknown> => Boolean(h) && typeof h === 'object')
    .map((h) => ({ at: String(h.at ?? ''), byName: String(h.byName ?? ''), text: String(h.text ?? '') }))
    .filter((h) => h.text);
}

export function toNocDto(row: NocRow): RegisteredOfficeNocDto {
  return {
    engagementId: appEngagementId(row.engagementId),
    status: coerceStatus(row.status),
    input: coerceNocInput(row.input),
    fileName: row.fileName,
    generatedAt: row.generatedAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    sentTo: row.sentTo ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    signedFileName: row.signedFileName ?? null,
    history: coerceHistory(row.history),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function canWrite(ctx: AuthContext): boolean {
  return isFirmWideAdmin(ctx.role) || ctx.role === 'manager';
}

/** The engagement's db id once the caller may read (write = true: may change) its NOC. */
async function gate(ctx: AuthContext, engagementId: string, write: boolean): Promise<string> {
  if (ctx.role === 'client') throw new NocAccessError('Engagement not found or not permitted', 404);
  if (write && !canWrite(ctx)) throw new NocAccessError('Only a project manager or an admin can change the NOC', 403);
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) throw new NocAccessError('Engagement not found or not permitted', 404);
  return access.dbId;
}

async function readRow(dbId: string): Promise<NocRow | null> {
  const [row] = await db.select().from(registeredOfficeNocs).where(eq(registeredOfficeNocs.engagementId, dbId)).limit(1);
  return row ?? null;
}

function entry(ctx: AuthContext, text: string, at: Date): NocHistoryEntry {
  return { at: at.toISOString(), byName: ctx.name || ctx.email, text };
}

export async function getRegisteredOfficeNoc(ctx: AuthContext, engagementId: string): Promise<RegisteredOfficeNocDto | null> {
  const dbId = await gate(ctx, engagementId, false);
  const row = await readRow(dbId);
  return row ? toNocDto(row) : null;
}

/** Every NOC in the caller's book (Clients page strip). Clients get nothing. */
export async function listRegisteredOfficeNocs(ctx: AuthContext): Promise<RegisteredOfficeNocDto[]> {
  if (ctx.role === 'client') return [];
  const ids = await listScopedEngagementIds(ctx);
  if (!ids.length) return [];
  const rows = await db.select().from(registeredOfficeNocs).where(inArray(registeredOfficeNocs.engagementId, ids));
  return rows.map(toNocDto);
}

/**
 * Save a freshly generated NOC (first time, or again after the details
 * changed). The signature track starts over: a changed NOC must be signed
 * again. Earlier files stay in storage; the history keeps the trail.
 */
export async function saveGeneratedNoc(
  ctx: AuthContext,
  engagementId: string,
  input: { noc: NocInput; fileName: string; key: string },
): Promise<RegisteredOfficeNocDto> {
  const dbId = await gate(ctx, engagementId, true);
  const now = new Date();
  const prev = await readRow(dbId);
  const history = [...coerceHistory(prev?.history), entry(ctx, prev ? 'Details changed · NOC generated again' : 'NOC generated', now)];
  const values = {
    input: input.noc,
    status: 'generated',
    fileName: input.fileName,
    generatedKey: input.key,
    generatedAt: now,
    generatedBy: ctx.userId,
    sentAt: null,
    sentBy: null,
    sentTo: null,
    signedKey: null,
    signedFileName: null,
    signedAt: null,
    signedBy: null,
    history,
    updatedAt: now,
  };
  const [row] = prev
    ? await db.update(registeredOfficeNocs).set(values).where(eq(registeredOfficeNocs.engagementId, dbId)).returning()
    : await db.insert(registeredOfficeNocs).values({ engagementId: dbId, ...values, createdAt: now }).returning();
  await recordAuditEvent(ctx, {
    engagementId: dbId,
    action: prev ? 'noc.regenerated' : 'noc.generated',
    summary: `${prev ? 'Registered office NOC generated again' : 'Registered office NOC generated'} · ${input.fileName}`,
    metadata: { fileName: input.fileName },
  });
  return toNocDto(row!);
}

/** Generated → sent to the owner for signature (also re-marks a sent NOC with a new recipient). */
export async function markNocSent(ctx: AuthContext, engagementId: string, to: string): Promise<RegisteredOfficeNocDto> {
  const dbId = await gate(ctx, engagementId, true);
  const prev = await readRow(dbId);
  if (!prev) throw new NocAccessError('Generate the NOC first', 409);
  if (prev.status === 'signed') throw new NocAccessError('The signed NOC is already in', 409);
  const now = new Date();
  const who = to.trim() || 'the owner';
  const [row] = await db
    .update(registeredOfficeNocs)
    .set({
      status: 'sent',
      sentAt: now,
      sentBy: ctx.userId,
      sentTo: who,
      history: [...coerceHistory(prev.history), entry(ctx, `Sent to ${who} for signature`, now)],
      updatedAt: now,
    })
    .where(eq(registeredOfficeNocs.engagementId, dbId))
    .returning();
  await recordAuditEvent(ctx, { engagementId: dbId, action: 'noc.sent', summary: `Registered office NOC sent to ${who} for signature` });
  return toNocDto(row!);
}

/** The signed copy is in (a staff upload). */
export async function attachSignedNoc(
  ctx: AuthContext,
  engagementId: string,
  file: { key: string; fileName: string },
): Promise<RegisteredOfficeNocDto> {
  const dbId = await gate(ctx, engagementId, true);
  const prev = await readRow(dbId);
  if (!prev) throw new NocAccessError('Generate the NOC first', 409);
  const now = new Date();
  const [row] = await db
    .update(registeredOfficeNocs)
    .set({
      status: 'signed',
      signedKey: file.key,
      signedFileName: file.fileName,
      signedAt: now,
      signedBy: ctx.userId,
      history: [...coerceHistory(prev.history), entry(ctx, `Signed NOC uploaded · ${file.fileName}`, now)],
      updatedAt: now,
    })
    .where(eq(registeredOfficeNocs.engagementId, dbId))
    .returning();
  await recordAuditEvent(ctx, {
    engagementId: dbId,
    action: 'noc.signed',
    summary: `Signed registered office NOC uploaded · ${file.fileName}`,
    metadata: { fileName: file.fileName },
  });
  return toNocDto(row!);
}

/** Storage key of one of the NOC's files, for a caller who may read it. */
export async function nocFileKey(
  ctx: AuthContext,
  engagementId: string,
  kind: 'generated' | 'signed',
): Promise<{ key: string; fileName: string } | null> {
  const dbId = await gate(ctx, engagementId, false);
  const row = await readRow(dbId);
  if (!row) return null;
  if (kind === 'signed') return row.signedKey ? { key: row.signedKey, fileName: row.signedFileName ?? 'signed-noc' } : null;
  return { key: row.generatedKey, fileName: row.fileName };
}

/** `{engagementDbId}/registered-office-noc/…` — the prefix every NOC object lives under. */
export function nocObjectKey(engagementDbId: string, kind: 'generated' | 'signed', fileName: string): string {
  const safe = fileName.split(/[/\\]/).pop()!.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
  return `${engagementDbId}/registered-office-noc/${kind === 'signed' ? 'signed/' : ''}${Date.now()}-${safe}`;
}

/** The db id behind an app id, for building object keys after the gate passed. */
export async function nocEngagementDbId(ctx: AuthContext, engagementId: string): Promise<string> {
  return gate(ctx, engagementId, true);
}
