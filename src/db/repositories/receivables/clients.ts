import 'server-only';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableClients, receivableInvoices, receivablePartners } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { clientByPrefix, clientKey } from '@/lib/receivables/client-key';
import type { ClientDto } from '@/lib/receivables/v2-wire';
import { UUID, conflict, invalid, logChange, notFound, num, scopedSheet } from './shared';

/**
 * RECEIVABLES v2 — the sheet's clients (docs/specs/receivables/V2.md). Every function goes through
 * `scopedSheet`, so only the sheet's manager, its extra editors and the firm-wide admins reach them.
 * A client has at most one client partner; changing it also moves the client's live invoices to
 * the new partner, so the emails and the sheet agree.
 */

export type ClientRow = typeof receivableClients.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanCreditDays(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 365) throw invalid('credit_days');
  return n;
}

function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (!s || s.length > 120 || !clientKey(s)) throw invalid('client');
  return s;
}

function cleanEmail(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = typeof v === 'string' ? v.trim() : '';
  if (!EMAIL.test(s) || s.length > 200) throw invalid('email');
  return s;
}

function cleanCc(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v) || v.length > 10) throw invalid('email');
  return [...new Set(v.map((e) => cleanEmail(e)).filter((e): e is string => Boolean(e)))];
}

function cleanGstin(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (s.length > 20) throw invalid('gstin');
  return s || null;
}

/** A partner id must belong to the same sheet, or be null. */
export async function sheetPartnerId(sheetId: string, partnerId: unknown, tx: DbLike = db): Promise<string | null> {
  if (partnerId === null || partnerId === undefined || partnerId === '') return null;
  if (typeof partnerId !== 'string' || !UUID.test(partnerId)) throw invalid('partner');
  const [p] = await tx
    .select({ id: receivablePartners.id })
    .from(receivablePartners)
    .where(and(eq(receivablePartners.id, partnerId), eq(receivablePartners.sheetId, sheetId)))
    .limit(1);
  if (!p) throw invalid('partner');
  return p.id;
}

function toClientDto(row: ClientRow, open: { amount: number; count: number } | undefined): ClientDto {
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin,
    creditDays: row.creditDays,
    billingEmail: row.billingEmail,
    billingCc: row.billingCc ?? [],
    partnerId: row.partnerId,
    active: row.active,
    openAmount: open?.amount ?? 0,
    openCount: open?.count ?? 0,
  };
}

/** The sheet's clients with their open balance. */
export async function listClients(ctx: AuthContext, sheetId: string): Promise<ClientDto[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const [rows, open] = await Promise.all([
    db.select().from(receivableClients).where(eq(receivableClients.sheetId, sheet.id)).orderBy(asc(receivableClients.name)),
    db
      .select({ clientId: receivableInvoices.clientId, amount: sql<string>`coalesce(sum(${receivableInvoices.amountInr}), 0)`, count: sql<number>`count(*)::int` })
      .from(receivableInvoices)
      .where(and(eq(receivableInvoices.sheetId, sheet.id), eq(receivableInvoices.status, 'open'), isNull(receivableInvoices.deletedAt)))
      .groupBy(receivableInvoices.clientId),
  ]);
  const byClient = new Map(open.filter((o) => o.clientId).map((o) => [o.clientId as string, { amount: num(o.amount) ?? 0, count: Number(o.count) }]));
  return rows.map((r) => toClientDto(r, byClient.get(r.id)));
}

/** The client of a sheet by id, if and only if the caller may edit the sheet. */
async function scopedClient(ctx: AuthContext, clientId: string): Promise<{ client: ClientRow; sheetId: string }> {
  if (!UUID.test(clientId ?? '')) throw notFound();
  const [client] = await db.select().from(receivableClients).where(eq(receivableClients.id, clientId)).limit(1);
  if (!client) throw notFound();
  const sheet = await scopedSheet(ctx, client.sheetId);
  return { client, sheetId: sheet.id };
}

export type ClientInput = {
  name: string;
  gstin?: string | null;
  creditDays?: number;
  billingEmail?: string | null;
  billingCc?: string[];
  partnerId?: string | null;
};

export async function addClient(ctx: AuthContext, sheetId: string, input: ClientInput): Promise<ClientDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const name = cleanName(input.name);
  const key = clientKey(name);
  const [dup] = await db
    .select({ id: receivableClients.id })
    .from(receivableClients)
    .where(and(eq(receivableClients.sheetId, sheet.id), eq(receivableClients.clientKey, key)))
    .limit(1);
  if (dup) throw invalid('client_exists');
  const [row] = await db
    .insert(receivableClients)
    .values({
      sheetId: sheet.id,
      name,
      clientKey: key,
      gstin: cleanGstin(input.gstin),
      creditDays: input.creditDays === undefined ? 7 : cleanCreditDays(input.creditDays),
      billingEmail: cleanEmail(input.billingEmail),
      billingCc: cleanCc(input.billingCc),
      partnerId: await sheetPartnerId(sheet.id, input.partnerId),
    })
    .returning();
  await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Client ${row.name} added`, affectsPage: false });
  return toClientDto(row, undefined);
}

/** Moves a client's live invoices to its partner, so the sheet and the emails agree. */
async function movePartnerInvoices(tx: DbLike, sheetId: string, clientIds: string[], partnerId: string | null): Promise<void> {
  if (!clientIds.length) return;
  await tx
    .update(receivableInvoices)
    .set({ partnerId, updatedAt: new Date() })
    .where(and(eq(receivableInvoices.sheetId, sheetId), inArray(receivableInvoices.clientId, clientIds), isNull(receivableInvoices.deletedAt)));
}

export type ClientPatch = Partial<ClientInput> & { active?: boolean };

export async function updateClient(ctx: AuthContext, clientId: string, patch: ClientPatch): Promise<ClientDto> {
  const { client, sheetId } = await scopedClient(ctx, clientId);
  const set: Partial<typeof receivableClients.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    const key = clientKey(name);
    if (key !== client.clientKey) {
      const [dup] = await db
        .select({ id: receivableClients.id })
        .from(receivableClients)
        .where(and(eq(receivableClients.sheetId, sheetId), eq(receivableClients.clientKey, key)))
        .limit(1);
      if (dup) throw invalid('client_exists');
    }
    set.name = name;
    set.clientKey = key;
  }
  if (patch.gstin !== undefined) set.gstin = cleanGstin(patch.gstin);
  if (patch.creditDays !== undefined) set.creditDays = cleanCreditDays(patch.creditDays);
  if (patch.billingEmail !== undefined) set.billingEmail = cleanEmail(patch.billingEmail);
  if (patch.billingCc !== undefined) set.billingCc = cleanCc(patch.billingCc);
  if (typeof patch.active === 'boolean') set.active = patch.active;
  const partnerChanged = patch.partnerId !== undefined && (patch.partnerId || null) !== client.partnerId;
  if (partnerChanged) set.partnerId = await sheetPartnerId(sheetId, patch.partnerId);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(receivableClients).set(set).where(eq(receivableClients.id, client.id)).returning();
    if (partnerChanged) await movePartnerInvoices(tx, sheetId, [client.id], updated.partnerId);
    // A renamed client renames its live invoices too, so the sheet and the emails show one name.
    if (set.name && set.name !== client.name) {
      await tx
        .update(receivableInvoices)
        .set({ clientName: set.name, updatedAt: new Date() })
        .where(and(eq(receivableInvoices.sheetId, sheetId), eq(receivableInvoices.clientId, client.id), isNull(receivableInvoices.deletedAt)));
    }
    await logChange(
      { sheetId, invoiceId: null, actorId: ctx.userId, summary: partnerChanged ? `Client ${updated.name} moved to another client partner` : `Client ${updated.name} updated`, affectsPage: partnerChanged },
      tx,
    );
    return updated;
  });
  const [open] = await db
    .select({ amount: sql<string>`coalesce(sum(${receivableInvoices.amountInr}), 0)`, count: sql<number>`count(*)::int` })
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.clientId, row.id), eq(receivableInvoices.status, 'open'), isNull(receivableInvoices.deletedAt)));
  return toClientDto(row, { amount: num(open?.amount) ?? 0, count: Number(open?.count ?? 0) });
}

/**
 * "Manage clients" on a partner card: `clientIds` becomes exactly that partner's set of clients.
 * Clients newly ticked move to the partner (from any other partner); clients unticked are left
 * with no partner. Their live invoices follow.
 */
export async function setPartnerClients(ctx: AuthContext, partnerId: string, clientIds: string[]): Promise<{ added: number; removed: number }> {
  if (!UUID.test(partnerId ?? '')) throw notFound();
  const [p] = await db.select().from(receivablePartners).where(eq(receivablePartners.id, partnerId)).limit(1);
  if (!p) throw notFound();
  const sheet = await scopedSheet(ctx, p.sheetId);
  const wanted = [...new Set(clientIds)].filter((id) => UUID.test(id));
  const clients = await db.select({ id: receivableClients.id, partnerId: receivableClients.partnerId }).from(receivableClients).where(eq(receivableClients.sheetId, sheet.id));
  const known = new Set(clients.map((c) => c.id));
  if (wanted.some((id) => !known.has(id))) throw invalid('client');
  const add = clients.filter((c) => wanted.includes(c.id) && c.partnerId !== p.id).map((c) => c.id);
  const remove = clients.filter((c) => !wanted.includes(c.id) && c.partnerId === p.id).map((c) => c.id);
  if (!add.length && !remove.length) return { added: 0, removed: 0 };
  await db.transaction(async (tx) => {
    const now = new Date();
    if (add.length) {
      await tx.update(receivableClients).set({ partnerId: p.id, updatedAt: now }).where(inArray(receivableClients.id, add));
      await movePartnerInvoices(tx, sheet.id, add, p.id);
    }
    if (remove.length) {
      await tx.update(receivableClients).set({ partnerId: null, updatedAt: now }).where(inArray(receivableClients.id, remove));
      await movePartnerInvoices(tx, sheet.id, remove, null);
    }
    await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Client partner ${p.name}: ${add.length} client(s) added, ${remove.length} removed` }, tx);
  });
  return { added: add.length, removed: remove.length };
}

/**
 * The client with this name on the sheet (same key, or a short name the Tally name starts with, see
 * `clientByPrefix`), created (no partner, 7 credit days) when there is none. Used inside the Tally staging transaction; the caller has already scoped the sheet.
 */
export async function findOrCreateClient(tx: DbLike, sheetId: string, name: string, gstin: string | null): Promise<ClientRow> {
  const key = clientKey(name);
  const [found] = await tx
    .select()
    .from(receivableClients)
    .where(and(eq(receivableClients.sheetId, sheetId), eq(receivableClients.clientKey, key)))
    .limit(1);
  // Tally's full legal name often starts with the short name already on the sheet.
  const existing = found ?? clientByPrefix(await tx.select().from(receivableClients).where(eq(receivableClients.sheetId, sheetId)), key);
  if (existing) {
    if (!existing.gstin && gstin) {
      const [row] = await tx.update(receivableClients).set({ gstin, updatedAt: new Date() }).where(eq(receivableClients.id, existing.id)).returning();
      return row;
    }
    return existing;
  }
  const [row] = await tx
    .insert(receivableClients)
    .values({ sheetId, name: name.trim().replace(/\s+/g, ' ').slice(0, 120), clientKey: key, gstin, creditDays: 7 })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  // Another upload created it a moment ago.
  const [again] = await tx
    .select()
    .from(receivableClients)
    .where(and(eq(receivableClients.sheetId, sheetId), eq(receivableClients.clientKey, key)))
    .limit(1);
  return again;
}

/**
 * Deletes a client (owner, 17 Nov 2026), only when it has no live invoices, so no invoice is left
 * without its client (409 `client_has_invoices`). Imported rows and logged emails keep their copy
 * of the name.
 */
export async function deleteClient(ctx: AuthContext, clientId: string): Promise<void> {
  const { client, sheetId } = await scopedClient(ctx, clientId);
  const [inv] = await db
    .select({ id: receivableInvoices.id })
    .from(receivableInvoices)
    .where(and(eq(receivableInvoices.clientId, client.id), isNull(receivableInvoices.deletedAt)))
    .limit(1);
  if (inv) throw conflict('client_has_invoices');
  await db.delete(receivableClients).where(and(eq(receivableClients.id, client.id), eq(receivableClients.sheetId, sheetId)));
  await logChange({ sheetId, invoiceId: null, actorId: ctx.userId, summary: `Client ${client.name} deleted`, affectsPage: false });
}
