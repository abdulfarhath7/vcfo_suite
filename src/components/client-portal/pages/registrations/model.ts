/**
 * Client portal · Registrations: the registration-phase steps of the client's incorporation
 * checklist (phase 4 of the step model) joined with the registration numbers already stored
 * on the credentials workbook (its Registrations sheet, filled from the registration steps or
 * typed in by SBC). Pure: no React, no fetch. A number that is not stored stays null; the
 * pages show an empty state for it and never a placeholder number.
 */
import { coerceStatusCode } from '@/data/checklist';
import { REG_ROWS, type CredentialsPayload } from '@/lib/client-portal/credentials';
import type { PortalIncorporationModel, PortalStep } from '@/lib/client-portal/step-model';

/** R-13: the six status words. */
export type RegStatus = 'Not started' | 'In progress' | 'Waiting' | 'Due soon' | 'Overdue' | 'Done';

export interface RegItem {
  /** URL segment: the checklist item slug. */
  id: string;
  stepId: string;
  /** Step number inside the registration phase (1-based). */
  n: number;
  name: string;
  group: string;
  /** The area or regulator word for the pill (R-43). */
  area: string;
  status: RegStatus;
  /** Marked not applicable on the checklist. */
  notNeeded: boolean;
  owner: PortalStep['owner'];
  due?: string;
  doneOn?: string;
  since?: string;
  windowFrom?: string;
  late: boolean;
  lateDays: number;
  forms: string[];
  /** Documents and details the step needs (checklist catalogue). */
  needs: string[];
  /** The credentials Registrations sheet row this step fills, when there is one. */
  regKey: string | null;
  number: string | null;
  registeredOn: string | null;
  certificate: string | null;
  step: PortalStep;
}

/** Groups as in VCFO Suite (General, Customs, Foreign trade, Labour, Local compliance, IP and brand, FEMA). */
const GROUP: Record<string, string> = {
  'reg-4': 'General',
  'reg-1': 'General',
  'reg-3': 'General',
  'reg-7': 'General',
  'reg-6': 'General',
  'reg-15': 'General',
  'reg-16': 'Customs',
  'reg-8': 'Customs',
  'reg-5': 'Customs',
  'reg-11': 'Foreign trade',
  'reg-9': 'Labour',
  'reg-13': 'Labour',
  'reg-14': 'Labour',
  'reg-10': 'Local compliance',
  'reg-12': 'IP and brand',
  'reg-17': 'IP and brand',
  'reg-18': 'IP and brand',
  'reg-19': 'IP and brand',
  'reg-20': 'FEMA',
  'reg-21': 'FEMA',
  'reg-22': 'FEMA',
  'reg-23': 'FEMA',
  'reg-24': 'FEMA',
};
export const GROUP_ORDER = ['General', 'Customs', 'Foreign trade', 'Labour', 'Local compliance', 'IP and brand', 'FEMA', 'Other'];

const AREA: Record<string, string> = {
  'reg-4': 'GST',
  'reg-5': 'GST',
  'reg-1': 'Payroll',
  'reg-3': 'Payroll',
  'reg-7': 'Labour',
  'reg-9': 'Labour',
  'reg-10': 'Labour',
  'reg-13': 'Labour',
  'reg-14': 'Labour',
  'reg-6': 'LEI',
  'reg-15': 'MSME',
  'reg-16': 'Customs',
  'reg-8': 'Customs',
  'reg-11': 'STPI',
  'reg-12': 'IP',
  'reg-17': 'IP',
  'reg-18': 'IP',
  'reg-19': 'IP',
  'reg-20': 'FEMA',
  'reg-21': 'FEMA',
  'reg-22': 'FEMA',
  'reg-23': 'FEMA',
  'reg-24': 'FEMA',
};

const REG_KEY_BY_TITLE = new Map(REG_ROWS.map(([key, label]) => [label.toLowerCase(), key]));

/** Status in the six words: late beats every open state; the client's move is Waiting. */
export function regStatus(s: Pick<PortalStep, 'kind' | 'late'>): RegStatus {
  if (s.kind === 'done') return 'Done';
  if (s.late) return 'Overdue';
  if (s.kind === 'you') return 'Waiting';
  if (s.kind === 'prog' || s.kind === 'with') return 'In progress';
  return 'Not started';
}

function cell(payload: CredentialsPayload | null | undefined, rowKey: string | null, col: string): string | null {
  if (!payload || !rowKey) return null;
  const row = payload.sheets?.reg?.rows?.find((r) => r.key === rowKey);
  const v = row?.cells?.[col]?.v;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function buildRegistrations(model: PortalIncorporationModel, credentials?: CredentialsPayload | null): RegItem[] {
  const phase = model.phases.find((p) => p.no === 4) ?? model.phases.find((p) => p.id.startsWith('registration'));
  if (!phase) return [];
  return phase.steps.map((s, i) => {
    const regKey = REG_KEY_BY_TITLE.get(s.title.toLowerCase()) ?? null;
    const gstin = regKey === 'gst' ? credentials?.ids?.find((t) => t.key === 'gstin')?.value?.trim() || null : null;
    return {
      id: s.item.slug,
      stepId: s.id,
      n: i + 1,
      name: s.title,
      group: GROUP[s.id] ?? 'Other',
      area: AREA[s.id] ?? 'Other',
      status: regStatus(s),
      notNeeded: coerceStatusCode(s.slice?.status) === 'not-applicable',
      owner: s.owner,
      due: s.due,
      doneOn: s.doneOn,
      since: s.since,
      windowFrom: s.windowFrom,
      late: s.late,
      lateDays: s.lateDays,
      forms: s.item.forms,
      needs: s.item.infoRequired,
      regKey,
      number: cell(credentials, regKey, 'number') ?? gstin,
      registeredOn: cell(credentials, regKey, 'date'),
      certificate: cell(credentials, regKey, 'cert'),
      step: s,
    } satisfies RegItem;
  });
}

/** Open registrations with a due date within `days` days (late ones included), soonest first. */
export function regDueWithin(items: RegItem[], today: string, days = 15): RegItem[] {
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return items
    .filter((r) => !r.notNeeded && r.status !== 'Done' && r.due && r.due <= limit)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
}

/** Registrations waiting on the client: the step is the client's move. */
export function regWaiting(items: RegItem[]): RegItem[] {
  return items.filter((r) => !r.notNeeded && r.step.kind === 'you');
}

/** The register obligations a registration starts, by area and name (GST returns, PF, ESI, PT). */
export function startsFilings(stepId: string): { area: 'GST' | 'PAY'; name?: RegExp } | null {
  if (stepId === 'reg-4') return { area: 'GST' };
  if (stepId === 'reg-1') return { area: 'PAY', name: /\bE?PF\b|EPF|provident/i };
  if (stepId === 'reg-3') return { area: 'PAY', name: /\bESI/i };
  if (stepId === 'reg-7') return { area: 'PAY', name: /\bPT\b|professional tax/i };
  return null;
}
