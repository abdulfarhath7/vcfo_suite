import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableDigestRecipients } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DigestRecipientDto } from '@/lib/receivables/v2-wire';
import { UUID, invalid, logChange, notFound, scopedSheet } from './shared';

/**
 * RECEIVABLES v2 — the leadership digest's recipients (docs/specs/receivables/V2.md). They are
 * typed-in names and addresses, not tool accounts. Every function goes through `scopedSheet`.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDto(row: typeof receivableDigestRecipients.$inferSelect): DigestRecipientDto {
  return { id: row.id, name: row.name, email: row.email, active: row.active };
}

function clean(input: { name?: unknown; email?: unknown }, required: boolean): { name?: string; email?: string } {
  const out: { name?: string; email?: string } = {};
  if (input.name !== undefined || required) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 120) throw invalid('name');
    out.name = name;
  }
  if (input.email !== undefined || required) {
    const email = typeof input.email === 'string' ? input.email.trim() : '';
    if (!EMAIL.test(email) || email.length > 200) throw invalid('email');
    out.email = email;
  }
  return out;
}

export async function listDigestRecipients(ctx: AuthContext, sheetId: string): Promise<DigestRecipientDto[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db.select().from(receivableDigestRecipients).where(eq(receivableDigestRecipients.sheetId, sheet.id)).orderBy(asc(receivableDigestRecipients.name));
  return rows.map(toDto);
}

export async function addDigestRecipient(ctx: AuthContext, sheetId: string, input: { name: string; email: string }): Promise<DigestRecipientDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const { name, email } = clean(input, true);
  const [row] = await db.insert(receivableDigestRecipients).values({ sheetId: sheet.id, name: name!, email: email! }).returning();
  await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Digest recipient ${row.name} added`, affectsPage: false });
  return toDto(row);
}

async function scopedRecipient(ctx: AuthContext, id: string) {
  if (!UUID.test(id ?? '')) throw notFound();
  const [row] = await db.select().from(receivableDigestRecipients).where(eq(receivableDigestRecipients.id, id)).limit(1);
  if (!row) throw notFound();
  const sheet = await scopedSheet(ctx, row.sheetId);
  return { row, sheetId: sheet.id };
}

export async function updateDigestRecipient(ctx: AuthContext, id: string, patch: { name?: string; email?: string; active?: boolean }): Promise<DigestRecipientDto> {
  const { row, sheetId } = await scopedRecipient(ctx, id);
  const set: Partial<typeof receivableDigestRecipients.$inferInsert> = clean(patch, false);
  if (typeof patch.active === 'boolean') set.active = patch.active;
  const [updated] = await db
    .update(receivableDigestRecipients)
    .set(set)
    .where(and(eq(receivableDigestRecipients.id, row.id), eq(receivableDigestRecipients.sheetId, sheetId)))
    .returning();
  return toDto(updated);
}

export async function removeDigestRecipient(ctx: AuthContext, id: string): Promise<void> {
  const { row, sheetId } = await scopedRecipient(ctx, id);
  await db.delete(receivableDigestRecipients).where(and(eq(receivableDigestRecipients.id, row.id), eq(receivableDigestRecipients.sheetId, sheetId)));
  await logChange({ sheetId, invoiceId: null, actorId: ctx.userId, summary: `Digest recipient ${row.name} removed`, affectsPage: false });
}
