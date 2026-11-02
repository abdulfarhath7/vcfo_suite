import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementCredentials } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { decryptSecrets, encryptSecrets } from '@/lib/credentials-crypto';
import {
  KYC_NAME_FIELD,
  KYC_ROWS,
  SHEET_COLS,
  cellLabel,
  parseCellKey,
  tabLabel,
  type CredSheet,
  type CredentialsPayload,
} from '@/lib/client-portal/credentials';
import {
  CredentialsError,
  SHEETS,
  type Access,
  resolveAccess,
  aadOf,
  isSecretCell,
  liveGrants,
  canEdit,
} from './access';
import { build } from './workbook';

/* ------------------------------------------------------------------ */
/* writes                                                              */
/* ------------------------------------------------------------------ */

async function requireEdit(ctx: AuthContext, acc: Access, key: string) {
  if (acc.staff) return;
  const grants = await liveGrants(ctx, acc.dbId);
  if (!canEdit(grants, key)) throw new CredentialsError('edit_grant_required', 403);
}

async function requireSheetEdit(ctx: AuthContext, acc: Access, sheet: CredSheet) {
  if (acc.staff) return;
  const grants = await liveGrants(ctx, acc.dbId);
  if (!grants.some((g) => g.mode === 'edit' && (g.scope === 'page' || g.scope === `tab:${sheet}`))) {
    throw new CredentialsError('edit_grant_required', 403);
  }
}

async function upsertStored(
  acc: Access,
  ctx: AuthContext,
  sheet: CredSheet,
  rowKey: string,
  mutate: (cur: { fields: Record<string, string>; secrets: Record<string, string>; edited: Record<string, boolean> }) => void,
  ordinal?: number,
) {
  const [cur] = await db
    .select()
    .from(engagementCredentials)
    .where(and(eq(engagementCredentials.engagementId, acc.dbId), eq(engagementCredentials.sheet, sheet), eq(engagementCredentials.rowKey, rowKey)))
    .limit(1);
  const aad = aadOf(acc.dbId, sheet, rowKey);
  const state = {
    fields: { ...(cur?.fields ?? {}) },
    secrets: decryptSecrets(cur?.secretCiphertext, aad),
    edited: { ...(cur?.edited ?? {}) },
  };
  mutate(state);
  const values = {
    fields: state.fields,
    secretCiphertext: encryptSecrets(state.secrets, aad),
    edited: state.edited,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };
  if (cur) {
    await db.update(engagementCredentials).set(values).where(eq(engagementCredentials.id, cur.id));
  } else {
    await db.insert(engagementCredentials).values({ engagementId: acc.dbId, sheet, rowKey, ordinal: ordinal ?? 0, ...values });
  }
}

const STATUSES = new Set(['Active', 'Pending', 'Expired', 'Not applicable']);

/**
 * Save one cell. `restore` = Undo: put back the previous value and its
 * Edited flag (an auto value that was never edited goes back to "Auto").
 */
export async function updateCredentialCell(
  ctx: AuthContext,
  input: { engagementId?: string | null; key: string; value: string; restore?: { edited: boolean } },
): Promise<CredentialsPayload> {
  const p = parseCellKey(input.key);
  if (!p || !SHEETS.includes(p.sheet as CredSheet)) throw new CredentialsError('invalid_cell', 400);
  const sheet = p.sheet as CredSheet;
  const value = String(input.value ?? '').trim().slice(0, 2000);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireEdit(ctx, acc, input.key);
  const before = await build(ctx, acc);
  const sh = before.payload.sheets[sheet];

  // Which stored row / field does this cell live in?
  let rowKey: string;
  let field: string;
  let secret = false;
  let isStatus = false;
  if (sheet === 'kyc') {
    if (p.row === 'h') {
      if (!sh.cols.some((c) => c.key === p.col && c.hdr)) throw new CredentialsError('invalid_cell', 400);
      rowKey = p.col;
      field = KYC_NAME_FIELD;
    } else {
      if (!KYC_ROWS.some((r) => r.key === p.row) || !sh.cols.some((c) => c.key === p.col && c.hdr)) throw new CredentialsError('invalid_cell', 400);
      rowKey = p.col;
      field = p.row;
      secret = isSecretCell('kyc', p.row, p.col);
    }
  } else {
    const row = sh.rows.find((r) => r.key === p.row && !r.spacer);
    const col = SHEET_COLS[sheet].find((c) => c.key === p.col);
    if (!row || !col || col.k === 'sno') throw new CredentialsError('invalid_cell', 400);
    rowKey = p.row;
    field = p.col;
    secret = Boolean(col.s);
    isStatus = col.k === 'status';
    if (isStatus && !STATUSES.has(value)) throw new CredentialsError('invalid_status', 400);
  }
  if (!value && !input.restore) throw new CredentialsError('empty_value', 400);

  const label = cellLabel(before.payload.sheets, before.payload.ids, input.key);
  const autoKey = sheet === 'kyc' ? `kyc|${p.row}|${p.col}` : `${sheet}|${p.row}|${p.col}`;
  const hasAuto = before.derived.auto.has(autoKey);
  await upsertStored(acc, ctx, sheet, rowKey, (cur) => {
    const target = secret ? cur.secrets : cur.fields;
    if (input.restore) {
      if (hasAuto && !input.restore.edited) {
        delete target[field];
        delete cur.edited[field];
      } else {
        if (value) target[field] = value;
        else delete target[field];
        if (input.restore.edited) cur.edited[field] = true;
        else delete cur.edited[field];
      }
    } else {
      target[field] = value;
      if (hasAuto) cur.edited[field] = true;
    }
  });
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: input.restore ? 'credentials.undo' : 'credentials.cell_updated',
    summary: input.restore
      ? `undid the change to ${label}`
      : isStatus
        ? `changed ${label} to ${value}`
        : `edited ${label}`,
    metadata: { key: input.key },
  });
  return (await build(ctx, acc)).payload;
}

/** Add a row (Login / Other) or a director column (Directors KYC). */
export async function addCredentialRow(
  ctx: AuthContext,
  input: { engagementId?: string | null; sheet: CredSheet },
): Promise<{ rowKey: string; payload: CredentialsPayload }> {
  if (!['login', 'other', 'kyc'].includes(input.sheet)) throw new CredentialsError('invalid_sheet', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireSheetEdit(ctx, acc, input.sheet);
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`coalesce(max(${engagementCredentials.ordinal}), 0)` })
    .from(engagementCredentials)
    .where(and(eq(engagementCredentials.engagementId, acc.dbId), eq(engagementCredentials.sheet, input.sheet)));
  const rowKey = input.sheet === 'kyc' ? `director:custom:${randomUUID()}` : `custom:${randomUUID()}`;
  const before = await build(ctx, acc);
  const sh = before.payload.sheets[input.sheet];
  await db.insert(engagementCredentials).values({
    engagementId: acc.dbId,
    sheet: input.sheet,
    rowKey,
    ordinal: Number(n) + 1,
    fields: input.sheet === 'login' ? { status: 'Pending' } : {},
    edited: {},
    updatedBy: ctx.userId,
  });
  const payload = (await build(ctx, acc)).payload;
  const letter = payload.sheets.kyc.cols.length - 1;
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.row_added',
    summary:
      input.sheet === 'kyc'
        ? `added a director column (${String.fromCharCode(65 + Math.min(letter, 25))}) to Directors KYC`
        : `added row ${sh.rows.length + 1} to ${tabLabel(input.sheet)}`,
    metadata: { sheet: input.sheet, rowKey },
  });
  return { rowKey, payload };
}

/** Undo of Add row / Add director: only custom rows can be removed. */
export async function removeCredentialRow(
  ctx: AuthContext,
  input: { engagementId?: string | null; sheet: CredSheet; rowKey: string },
): Promise<CredentialsPayload> {
  if (!input.rowKey.startsWith('custom:') && !input.rowKey.startsWith('director:custom:')) throw new CredentialsError('invalid_row', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireSheetEdit(ctx, acc, input.sheet);
  const before = await build(ctx, acc);
  const idx = input.sheet === 'kyc'
    ? before.payload.sheets.kyc.cols.findIndex((c) => c.key === input.rowKey)
    : before.payload.sheets[input.sheet].rows.findIndex((r) => r.key === input.rowKey);
  const del = await db
    .delete(engagementCredentials)
    .where(
      and(
        eq(engagementCredentials.engagementId, acc.dbId),
        eq(engagementCredentials.sheet, input.sheet),
        eq(engagementCredentials.rowKey, input.rowKey),
      ),
    )
    .returning({ id: engagementCredentials.id });
  if (del.length) {
    void recordAuditEvent(ctx, {
      engagementId: acc.dbId,
      action: 'credentials.row_removed',
      summary:
        input.sheet === 'kyc'
          ? `removed the new director column (${String.fromCharCode(65 + Math.max(0, Math.min(idx, 25)))})`
          : `removed row ${idx + 1} from ${tabLabel(input.sheet)}`,
      metadata: { sheet: input.sheet, rowKey: input.rowKey },
    });
  }
  return (await build(ctx, acc)).payload;
}
