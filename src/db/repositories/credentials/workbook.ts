import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { decryptSecrets } from '@/lib/credentials-crypto';
import {
  ADDRESS_ROWS,
  KYC_NAME_FIELD,
  KYC_ROWS,
  LABEL_COL,
  LOGIN_ROWS,
  REG_ROWS,
  REG_SHORT,
  SHEET_COLS,
  maskEmail,
  maskId,
  type CredSheet,
  type CredSource,
  type CredentialsPayload,
  type WireCell,
  type WireCol,
  type WireIdTile,
  type WireRow,
  type WireSheet,
} from '@/lib/client-portal/credentials';
import {
  type Access,
  resolveAccess,
  type StoredRow,
  aadOf,
  loadStored,
  isSecretCell,
  liveGrants,
  canSee,
} from './access';
import { type Derived, derive } from './derive';

/* ------------------------------------------------------------------ */
/* build the workbook                                                  */
/* ------------------------------------------------------------------ */

interface Built {
  payload: CredentialsPayload;
  /** Every secret value by cell key (server-side only). */
  secrets: Map<string, string>;
  stored: StoredRow[];
  derived: Derived;
}

export async function build(ctx: AuthContext, acc: Access): Promise<Built> {
  const derived = derive(ctx, acc.row);
  const stored = await loadStored(acc.dbId);
  const grants = acc.staff ? [] : await liveGrants(ctx, acc.dbId);
  const secrets = new Map<string, string>();
  const byKey = new Map(stored.map((s) => [`${s.sheet}|${s.rowKey}`, s]));
  const dec = new Map<string, Record<string, string>>();
  const secretsOf = (s: StoredRow | undefined): Record<string, string> => {
    if (!s) return {};
    const k = `${s.sheet}|${s.rowKey}`;
    if (!dec.has(k)) dec.set(k, decryptSecrets(s.secretCiphertext, aadOf(acc.dbId, s.sheet, s.rowKey)));
    return dec.get(k)!;
  };
  const visible = (key: string) => acc.staff || canSee(grants, key);

  /** One cell: stored value wins (Edited when it overrides an auto value). */
  const cellOf = (sheet: CredSheet, rowKey: string, colKey: string, storeRow: StoredRow | undefined, storeField: string, autoKey: string): WireCell => {
    const secret = isSecretCell(sheet, rowKey, colKey);
    const a = derived.auto.get(autoKey);
    const storedVal = secret ? secretsOf(storeRow)[storeField] : storeRow?.fields?.[storeField];
    const edited = Boolean(storeRow?.edited?.[storeField]);
    let v: string | undefined;
    let src: CredSource | undefined;
    let doc: string | undefined;
    if (storedVal != null && storedVal !== '') {
      v = storedVal;
      if (a) src = a.src;
    } else if (a) {
      v = a.v;
      src = a.src;
      doc = a.doc;
    }
    const key = `${sheet}|${rowKey}|${colKey}`;
    const out: WireCell = { v: v ?? '' };
    if (src) out.src = src;
    if (src && edited) out.edited = true;
    if (doc) out.doc = doc;
    if (secret && v) {
      secrets.set(key, v);
      out.has = true;
      if (!visible(key)) out.v = null;
    }
    return out;
  };

  const sheets = {} as Record<CredSheet, WireSheet>;

  /* flat sheets */
  for (const sheet of ['address', 'login', 'reg', 'other'] as const) {
    const cols: WireCol[] = SHEET_COLS[sheet].map((c) => ({ ...c }));
    const template: Array<[string, string] | null> =
      sheet === 'login' ? LOGIN_ROWS : sheet === 'reg' ? REG_ROWS : sheet === 'address' ? ADDRESS_ROWS : [];
    const rows: WireRow[] = [];
    const pushRow = (rowKey: string, label: string, custom: boolean) => {
      const sr = byKey.get(`${sheet}|${rowKey}`);
      const cells: Record<string, WireCell> = {};
      for (const c of cols) {
        if (c.k === 'sno') continue;
        if (c.key === LABEL_COL) {
          cells[c.key] = { v: sr?.fields?.[LABEL_COL] || label };
          continue;
        }
        if (c.k === 'status') {
          cells[c.key] = { v: sr?.fields?.status || 'Pending' };
          continue;
        }
        cells[c.key] = cellOf(sheet, rowKey, c.key, sr, c.key, `${sheet}|${rowKey}|${c.key}`);
      }
      // Company IDs from the company record wait for the COI (prototype "Pending COI").
      if (sheet === 'login' && ['cin', 'pan', 'tan-traces', 'tan-it', 'traces'].includes(rowKey) && !cells.id?.v && !cells.id?.has) {
        cells.id = { v: 'Pending COI' };
      }
      rows.push({ key: rowKey, cells, ...(custom ? { custom: true } : {}) });
    };
    let spacer = 0;
    for (const t of template) {
      if (!t) {
        rows.push({ key: `spacer-${spacer++}`, spacer: true, cells: {} });
        continue;
      }
      pushRow(t[0], t[1], false);
    }
    stored
      .filter((s) => s.sheet === sheet && s.rowKey.startsWith('custom:'))
      .sort((a, b) => a.ordinal - b.ordinal || a.createdAt.getTime() - b.createdAt.getTime())
      .forEach((s) => pushRow(s.rowKey, '', true));
    sheets[sheet] = { id: sheet, cols, rows };
  }

  /* Directors KYC (transposed) */
  const dirKeys: Array<{ key: string; name: string; custom: boolean }> = derived.directors.map((d) => ({ ...d, custom: false }));
  stored
    .filter((s) => s.sheet === 'kyc' && !dirKeys.some((d) => d.key === s.rowKey))
    .sort((a, b) => a.ordinal - b.ordinal || a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((s) => dirKeys.push({ key: s.rowKey, name: '', custom: s.rowKey.startsWith('director:custom:') }));
  const kycCols: WireCol[] = [{ key: LABEL_COL, n: 'Particulars' }];
  for (const d of dirKeys) {
    const sr = byKey.get(`kyc|${d.key}`);
    kycCols.push({ key: d.key, n: sr?.fields?.[KYC_NAME_FIELD] || d.name || 'New director', hdr: true });
  }
  sheets.kyc = {
    id: 'kyc',
    cols: kycCols,
    rows: KYC_ROWS.map((p) => {
      const cells: Record<string, WireCell> = { [LABEL_COL]: { v: p.n } };
      for (const d of dirKeys) {
        const sr = byKey.get(`kyc|${d.key}`);
        cells[d.key] = cellOf('kyc', p.key, d.key, sr, p.key, `kyc|${p.key}|${d.key}`);
      }
      return { key: p.key, cells };
    }),
  };

  /* identifier tiles */
  const tile = (key: WireIdTile['key'], name: string, auth: WireIdTile['auth'], v: string | undefined, secret: boolean): WireIdTile => {
    const ck = `ids|${key}|value`;
    if (!v) return { key, name, auth, value: null, masked: null, secret };
    if (!secret) return { key, name, auth, value: v, masked: null, secret };
    secrets.set(ck, v);
    return { key, name, auth, value: visible(ck) ? v : null, masked: maskId(v), secret };
  };
  const ids = [
    tile('cin', 'CIN', 'mca', derived.ids.cin, false),
    tile('pan', 'PAN', 'it', derived.ids.pan, true),
    tile('tan', 'TAN', 'it', derived.ids.tan, true),
    tile('gstin', 'GSTIN', 'gst', derived.ids.gstin, false),
  ];
  const regNames = sheets.reg.rows
    .filter((r) => (r.cells.number?.v ?? '').trim())
    .map((r) => REG_SHORT[r.key] ?? r.cells[LABEL_COL]?.v ?? '')
    .filter((x, i, a) => x && a.indexOf(x) === i);

  const recipients = await resolveEngagementRecipients(acc.dbId);
  const mgr = recipients?.managers?.[0] ?? recipients?.manager ?? recipients?.leads?.[0] ?? null;

  return {
    payload: {
      engagementId: appEngagementId(acc.dbId),
      companyName: acc.row.companyName,
      registeredAddress: derived.registeredAddress,
      manager: mgr ? { name: mgr.name, emailMasked: maskEmail(mgr.email) } : null,
      ids,
      registrationsSummary: regNames.length ? regNames.join(' · ') : null,
      directors: dirKeys.length,
      sheets,
      grants: grants.map((g) => ({ id: g.id, mode: g.mode, scope: g.scope, expiresAt: g.expiresAt.toISOString() })),
      staff: acc.staff,
    },
    secrets,
    stored,
    derived,
  };
}

export async function getCredentials(ctx: AuthContext, engagementId?: string | null): Promise<CredentialsPayload> {
  const acc = await resolveAccess(ctx, engagementId);
  return (await build(ctx, acc)).payload;
}
