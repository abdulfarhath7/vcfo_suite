/**
 * Credentials view-model (pure). Turns the real workbook payload
 * (src/lib/client-portal/credentials.ts, GET /api/client/credentials) into
 * the prototype's shapes (a6_rest.js renderCredentials): portal key cards
 * built from the Login Credentials sheet, the attention line, and the grant
 * arithmetic (what is visible / editable right now, for how long).
 */
import { LABEL_COL, scopesCovering, type CredMode, type CredSheet, type WireGrant, type WireRow, type WireSheet } from '@/lib/client-portal/credentials';
import type { LawKey } from '../../ui';

export type KeyStatus = 'active' | 'pending' | 'expired' | 'na';

export const KSTAT: Record<KeyStatus, ['ok' | 'due' | 'over' | 'mut', string]> = {
  active: ['ok', 'Active'],
  pending: ['due', 'Pending'],
  expired: ['over', 'Expired'],
  na: ['mut', 'Not applicable'],
};

export function statusOf(v: string | null | undefined): KeyStatus {
  switch ((v ?? '').trim()) {
    case 'Active':
      return 'active';
    case 'Expired':
      return 'expired';
    case 'Not applicable':
      return 'na';
    default:
      return 'pending';
  }
}

/** Area of law behind a login row (colours the key tile). */
const LAW_OF: Record<string, LawKey> = {
  cin: 'MCA', adt1: 'MCA', 'mca-v3': 'MCA', address: 'MCA', mail: 'MCA',
  pan: 'IT', 'tan-traces': 'IT', 'tan-it': 'IT', traces: 'IT', zoho: 'IT',
  gst: 'GST', 'gst-einvoice': 'GST', lut: 'GST', iec: 'GST',
  esi: 'PAY', pf: 'PAY', se: 'PAY', pt: 'PAY', posh: 'PAY', nps: 'PAY', cbo: 'PAY', pluxee: 'PAY', papaya: 'PAY',
  'non-stpi': 'FEMA', 'rbi-entity': 'FEMA', 'rbi-business': 'FEMA', fla: 'FEMA', flair: 'FEMA', jpmc: 'FEMA', reporting: 'FEMA', bank: 'FEMA',
};
export const lawOfRow = (key: string): LawKey => LAW_OF[key] ?? 'MCA';

/** Short tile text (prototype `mono`). */
const MONO: Record<string, string> = {
  cin: 'CIN', pan: 'PAN', 'tan-traces': 'TAN', 'tan-it': 'TAN', esi: 'ESI', pf: 'PF', gst: 'GST', 'gst-einvoice': 'INV', lut: 'LUT', bank: 'BNK',
  se: 'S&E', pt: 'PT', iec: 'IEC', mail: 'MAIL', 'non-stpi': 'STP', 'rbi-entity': 'RBI', 'rbi-business': 'RBI', fla: 'FLA', traces: 'TDS', zoho: 'ZB',
  papaya: 'PAY', pluxee: 'PLX', adt1: 'ADT', 'mca-v3': 'MCA', nps: 'NPS', cbo: 'CBO', posh: 'SHE', flair: 'FLA', address: 'ADR', jpmc: 'JPM', reporting: 'RPT',
};
export function monoOf(key: string, label: string): string {
  if (MONO[key]) return MONO[key]!;
  const w = label.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return (w.length >= 2 ? w.map((x) => x[0]).join('') : label.slice(0, 3)).toUpperCase().slice(0, 3) || 'KEY';
}

/** The official portal behind a login row, when there is one (government portals only). */
const PORTAL_URL: Record<string, { host: string; url: string }> = {
  cin: { host: 'mca.gov.in', url: 'https://www.mca.gov.in/' },
  'mca-v3': { host: 'mca.gov.in', url: 'https://www.mca.gov.in/' },
  adt1: { host: 'mca.gov.in', url: 'https://www.mca.gov.in/' },
  pan: { host: 'incometax.gov.in', url: 'https://www.incometax.gov.in/' },
  'tan-it': { host: 'incometax.gov.in', url: 'https://www.incometax.gov.in/' },
  'tan-traces': { host: 'tdscpc.gov.in', url: 'https://www.tdscpc.gov.in/' },
  traces: { host: 'tdscpc.gov.in', url: 'https://www.tdscpc.gov.in/' },
  gst: { host: 'gst.gov.in', url: 'https://www.gst.gov.in/' },
  'gst-einvoice': { host: 'einvoice.gst.gov.in', url: 'https://einvoice.gst.gov.in/' },
  lut: { host: 'gst.gov.in', url: 'https://www.gst.gov.in/' },
  esi: { host: 'esic.gov.in', url: 'https://www.esic.gov.in/' },
  pf: { host: 'epfindia.gov.in', url: 'https://unifiedportal-emp.epfindia.gov.in/' },
  iec: { host: 'dgft.gov.in', url: 'https://www.dgft.gov.in/' },
  'non-stpi': { host: 'stpi.in', url: 'https://stpi.in/' },
  'rbi-entity': { host: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in/' },
  'rbi-business': { host: 'firms.rbi.org.in', url: 'https://firms.rbi.org.in/' },
  fla: { host: 'flair.rbi.org.in', url: 'https://flair.rbi.org.in/' },
  flair: { host: 'flair.rbi.org.in', url: 'https://flair.rbi.org.in/' },
  posh: { host: 'shebox.wcd.gov.in', url: 'https://shebox.wcd.gov.in/' },
};
export const portalOf = (key: string): { host: string; url: string } | undefined => PORTAL_URL[key];

export interface PortalKey {
  row: WireRow;
  key: string;
  name: string;
  law: LawKey;
  mono: string;
  status: KeyStatus;
  portal?: { host: string; url: string };
}

const hasValue = (row: WireRow, col: string): boolean => {
  const c = row.cells[col];
  return Boolean(c && (c.has || (c.v && c.v.trim())));
};

/**
 * Portal key cards: the Login Credentials rows that hold something (an ID,
 * password, mail or mobile — masked or not) or whose status was set. Template
 * rows nobody filled stay in the sheet only. Expired first, then pending, then active.
 */
export function portalKeys(login: WireSheet | undefined): PortalKey[] {
  if (!login) return [];
  const order: Record<KeyStatus, number> = { expired: 0, pending: 1, active: 2, na: 3 };
  return login.rows
    .filter((r) => !r.spacer)
    .filter((r) => ['id', 'password', 'mail', 'mobile'].some((c) => hasValue(r, c)) || (r.cells.status?.v && r.cells.status.v !== 'Pending'))
    .map((r) => {
      const name = r.cells[LABEL_COL]?.v || 'Login';
      return { row: r, key: r.key, name, law: lawOfRow(r.key), mono: monoOf(r.key, name), status: statusOf(r.cells.status?.v), portal: portalOf(r.key) };
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}

/** The attention line: expired logins (red), then pending ones (amber). */
export function attention(keys: PortalKey[]): Array<{ key: string; text: string; tone: 'r' | 'a' }> {
  return keys
    .filter((k) => k.status === 'expired' || k.status === 'pending')
    .map((k) => ({ key: k.key, text: `${k.name} ${k.status}`, tone: k.status === 'expired' ? ('r' as const) : ('a' as const) }));
}

/* ---------------------------------------------------------------- grants */

export function liveGrants(grants: WireGrant[] | undefined, now: number): WireGrant[] {
  return (grants ?? []).filter((g) => new Date(g.expiresAt).getTime() > now);
}

/** Latest expiry (ms) of a live grant on `scope`, 0 when none. */
export function until(grants: WireGrant[], scope: string, modes?: CredMode[], now: number = Date.now()): number {
  return grants
    .filter((g) => g.scope === scope && (!modes || modes.includes(g.mode)) && new Date(g.expiresAt).getTime() > now)
    .reduce((m, g) => Math.max(m, new Date(g.expiresAt).getTime()), 0);
}

export function modeOf(grants: WireGrant[], scope: string): '' | 'Edit' | 'Preview' {
  return until(grants, scope, ['edit']) ? 'Edit' : until(grants, scope) ? 'Preview' : '';
}

/** A secret cell is readable when any covering scope has a live grant (or the caller is staff). */
export function previewed(grants: WireGrant[], staff: boolean, cellKey: string): boolean {
  return staff || scopesCovering(cellKey).some((s) => until(grants, s) > 0);
}

/** Scopes whose edit grant lets the caller change a cell. */
export function editScopes(sheet: CredSheet, row: string): string[] {
  return ['page', `tab:${sheet}`, ...(row !== 'h' ? [`row:${sheet}|${row}`] : [])];
}

export function canEdit(grants: WireGrant[], staff: boolean, sheet: CredSheet, row: string): boolean {
  return staff || editScopes(sheet, row).some((s) => until(grants, s, ['edit']) > 0);
}

export function fmtLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Mask shown for a secret cell that holds a value. */
export const MASK = '••••••••';
