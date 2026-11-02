/**
 * Home section — pure helpers (no React, no db) behind the company strip, the
 * orbit, the dock, the countdown card and the status brief. Everything here is
 * derived from real rows: the filing register (PortalFiling), the Home
 * aggregate (ClientHome: open document requests, who owns a filing), the step
 * model (PortalIncorporationModel) and the shell (company, team).
 *
 * Prototype counterparts: a1_core.js HOLDS / holdsLeft / nextDeadline,
 * a2_home.js groupsOf / monthStats, a6_rest.js briefText.
 */
import { statusOf, type AreaCode, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import type { ClientHome, HomeNeedRequest, NeedKind } from '@/lib/client-home';
import type { PortalIncorporationModel, PortalStep } from '@/lib/client-portal/step-model';
import type { ClientPortalContact } from '@/lib/client-portal/types';
import type { ClientOverviewEngagement } from '@/lib/client-overview';
import { approvalStateOf } from '@/lib/checklist-step-approval';
import { isClientFillAwaitingClient } from '@/lib/checklist-client-fill';
import { isReviewRejected } from '@/lib/checklist-item-review';
import { daysTo, fmt, fmtL, fyOf, rel } from '../../dates';

export const ST_RANK: Record<CompStatus, number> = { over: 0, due: 1, up: 2, ok: 3 };

/* ---------------------------------------------------------------- company strip */

const LEGAL_FORM_LABEL: Record<ClientOverviewEngagement['legalForm'], string> = {
  company: 'Private Limited',
  llp: 'LLP',
  partnership: 'Partnership Firm',
  proprietorship: 'Proprietorship',
};

/** "Bengaluru" from "WeWork Prestige Central, Bengaluru 560001" (last segment, PIN code dropped). */
export function cityOf(address?: string | null): string | undefined {
  const a = address?.trim();
  if (!a) return undefined;
  const parts = a.split(/[,\n]/).map((p) => p.replace(/\b\d{6}\b/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return undefined;
  // "…, Bengaluru, Karnataka" (street, city, state): keep the last two when both are plain words
  const prev = parts.length > 2 ? parts[parts.length - 2] : undefined;
  if (prev && /^[A-Za-z .]{3,24}$/.test(prev) && /^[A-Za-z .]{3,24}$/.test(last)) return `${prev} · ${last}`;
  return /^[A-Za-z .-]{3,40}$/.test(last) ? last : undefined;
}

/** The sub line under the company name: "Private Limited · Bengaluru · subsidiary of Halcyon Payments Pte Ltd, Singapore". Only what exists. */
export function companySubLine(eng?: Pick<ClientOverviewEngagement, 'legalForm' | 'registeredOffice' | 'parentEntityName'> | null): string {
  if (!eng) return '';
  const bits: string[] = [];
  const form = LEGAL_FORM_LABEL[eng.legalForm];
  if (form) bits.push(form);
  const city = cityOf(eng.registeredOffice);
  if (city) bits.push(city);
  if (eng.parentEntityName?.trim()) bits.push(`subsidiary of ${eng.parentEntityName.trim()}`);
  return bits.join(' · ');
}

/** STAGE chip: "Phase 3 · Post-incorporation", "Phase 3 → 4" when two phases are under way, "Complete" when all done. */
export function stageLabel(model: PortalIncorporationModel): string | undefined {
  if (!model.phases.length) return undefined;
  const active = model.phases.filter((p) => p.state === 'active');
  if (!active.length) return model.phases.every((p) => p.state === 'done') ? 'Complete' : `Phase ${model.phases[0]!.no} · ${model.phases[0]!.name}`;
  if (active.length === 1) return `Phase ${active[0]!.no} · ${active[0]!.name}`;
  return `Phase ${active[0]!.no} → ${active[active.length - 1]!.no}`;
}

/** READY BY chip: the manager's expected date — the last phase window end, else the incorporation window end. */
export function readyBy(model: PortalIncorporationModel, today: string): string | undefined {
  if (model.phases.length && model.phases.every((p) => p.state === 'done')) return undefined;
  const last = [...model.phases].reverse().find((p) => p.end && p.state !== 'done')?.end;
  const d = last ?? model.coiExpected;
  if (!d) return undefined;
  return d < today && !last ? undefined : d;
}

/* ---------------------------------------------------------------- filings */

export function overdueOf(rows: PortalFiling[], today: string): PortalFiling[] {
  return rows.filter((r) => statusOf(r, today) === 'over').sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}
export function filedOf(rows: PortalFiling[]): PortalFiling[] {
  return rows.filter((r) => Boolean(r.filedOn));
}
/**
 * The next unfiled filing due today or later — on the register only: a line from
 * SBC's compliance calendar (`fromCalendar`) is not the company's deadline yet.
 */
export function nextDeadlineOf(rows: PortalFiling[], today: string): PortalFiling | undefined {
  return rows.filter((r) => !r.fromCalendar && !r.filedOn && r.dueDate >= today).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))[0];
}
/** Unfiled, due within the next `n` days (today included) — register rows only. */
export function dueWithin(rows: PortalFiling[], today: string, n: number): PortalFiling[] {
  return rows
    .filter((r) => !r.fromCalendar && !r.filedOn && daysTo(r.dueDate, today) >= 0 && daysTo(r.dueDate, today) <= n)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
}

/** One orbit tick: every filing of one law on one date; the lead is the worst-status one. */
export interface OrbitGroup {
  items: PortalFiling[];
  lead: PortalFiling;
  st: CompStatus;
  law: AreaCode;
  d: string;
}

export function groupsOf(list: PortalFiling[], today: string): OrbitGroup[] {
  const map = new Map<string, PortalFiling[]>();
  for (const r of list) {
    const k = `${r.area}|${r.dueDate}`;
    const a = map.get(k);
    if (a) a.push(r);
    else map.set(k, [r]);
  }
  return [...map.values()].map((items) => {
    items.sort((a, b) => ST_RANK[statusOf(a, today)] - ST_RANK[statusOf(b, today)]);
    const lead = items[0]!;
    return { items, lead, st: statusOf(lead, today), law: lead.area, d: lead.dueDate };
  });
}

export function monthStats(rows: PortalFiling[], ym: string, today: string): { list: PortalFiling[]; c: Record<CompStatus, number> } {
  const list = rows.filter((r) => r.dueDate.startsWith(ym));
  const c: Record<CompStatus, number> = { over: 0, due: 0, up: 0, ok: 0 };
  for (const r of list) c[statusOf(r, today)]++;
  return { list, c };
}

export function worstOf(rows: PortalFiling[], today: string): CompStatus {
  let w: CompStatus = 'ok';
  for (const r of rows) {
    const s = statusOf(r, today);
    if (ST_RANK[s] < ST_RANK[w]) w = s;
  }
  return w;
}

/* ---------------------------------------------------------------- the dock */

export type DockOpen =
  | { kind: 'step'; stepId: string }
  | { kind: 'request'; requestId: string; stepId?: string }
  | { kind: 'filing'; filingId: string };

/** One thing waiting on the client (prototype HOLDS). */
export interface DockItem {
  key: string;
  title: string;
  /** what kind of move it is */
  need: NeedKind | 'filing';
  /** overdue (past its date) or simply the client's */
  sev: 'over' | 'you';
  due?: string;
  /** second line ("Overdue since 1 Oct · registered office proof") */
  tag: string;
  /** the step / filing it belongs to */
  sub: string;
  open: DockOpen;
}

const NEED_WORD: Record<NeedKind | 'filing', string> = { upload: 'upload', fill: 'fill in', correct: 'correct', sign: 'approve', filing: 'filing' };

function dockTag(due: string | undefined, today: string, sub: string): string {
  if (!due) return sub;
  const n = daysTo(due, today);
  if (n < 0) return `Overdue since ${fmt(due)}${sub ? ` · ${sub}` : ''}`;
  return `Due ${fmt(due)} · ${rel(n)}`;
}

/**
 * Everything waiting on the client, overdue first then by date:
 *  - open document requests (ClientHome.needs: upload / fill / correct / sign);
 *  - steps whose move is the client's (step model kind = you);
 *  - overdue filings whose owner is the client.
 */
export function buildDock(
  model: PortalIncorporationModel,
  home: ClientHome | null | undefined,
  rows: PortalFiling[],
  today: string,
): DockItem[] {
  const out: DockItem[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const linkedFilings = new Set<string>();
  const linkedSteps = new Set<string>();

  for (const r of home?.needs ?? []) {
    const step = r.stepId ? model.byId[r.stepId] : undefined;
    const filing = r.complianceInstanceId ? byId.get(r.complianceInstanceId) : undefined;
    if (filing) linkedFilings.add(filing.id);
    if (step) linkedSteps.add(step.id);
    const due = r.dueDate ?? filing?.dueDate ?? step?.due;
    const sub = step ? step.title : filing ? `${filing.name}${filing.period ? ` · ${filing.period}` : ''}` : r.requestedByName ? `Asked by ${r.requestedByName}` : `To ${NEED_WORD[r.kind]}`;
    out.push({
      key: `req:${r.id}`,
      title: r.title,
      need: r.kind,
      sev: due && due < today ? 'over' : 'you',
      due,
      tag: dockTag(due, today, sub),
      sub,
      open: { kind: 'request', requestId: r.id, stepId: step?.id },
    });
  }

  for (const s of model.steps) {
    if (s.kind !== 'you' || linkedSteps.has(s.id)) continue;
    const { title, need } = stepNeed(s);
    const sub = `Step ${s.n} · ${s.title}`;
    out.push({
      key: `step:${s.id}`,
      title,
      need,
      sev: s.late || (s.due ? s.due < today : false) ? 'over' : 'you',
      due: s.due,
      tag: s.due ? dockTag(s.due, today, s.late ? 'past its window' : '') : sub,
      sub,
      open: { kind: 'step', stepId: s.id },
    });
  }

  for (const hf of home?.filings.rows ?? []) {
    if (hf.owner !== 'client' || hf.filedOn || hf.dueDate >= today || linkedFilings.has(hf.id)) continue;
    const f = byId.get(hf.id);
    if (!f) continue;
    const sub = hf.needTitle ?? `${f.authorityName} · ${f.period}`;
    out.push({
      key: `filing:${f.id}`,
      title: `${f.name}${f.period ? ` · ${f.period}` : ''}`,
      need: 'filing',
      sev: 'over',
      due: f.dueDate,
      tag: dockTag(f.dueDate, today, hf.needTitle ?? 'your move'),
      sub,
      open: { kind: 'filing', filingId: f.id },
    });
  }

  return out.sort((a, b) => {
    if (a.sev !== b.sev) return a.sev === 'over' ? -1 : 1;
    if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    return a.due ? -1 : b.due ? 1 : 0;
  });
}

/** The client's move on a step, worded by what it is (sent back / approve / fill in). */
export function stepNeed(s: PortalStep): { title: string; need: NeedKind } {
  const slice = s.slice;
  if (isReviewRejected(slice)) {
    const note = slice?.rejectionNote?.trim();
    return { title: note ? (note.length > 56 ? `${note.slice(0, 54)}…` : note) : `${s.title} — sent back`, need: 'correct' };
  }
  if (approvalStateOf(slice) === 'pending_client') return { title: `Approve ${s.title}`, need: 'sign' };
  if (isClientFillAwaitingClient(slice?.clientFillRequest)) return { title: s.title, need: 'fill' };
  return { title: s.title, need: 'fill' };
}

/* ---------------------------------------------------------------- the status brief */

export interface BriefInput {
  companyName: string;
  companyShort: string;
  model: PortalIncorporationModel;
  /** this financial year's register (filed this FY) */
  rows: PortalFiling[];
  /** the whole register, every year (overdue, due soon); defaults to `rows` */
  all?: PortalFiling[];
  dock: DockItem[];
  team: Pick<ClientPortalContact, 'name' | 'role' | 'support'>[];
  today: string;
}

const list = (xs: string[]): string => xs.join('; ');

/** Plain text of the status brief (prototype briefText), every line from real data. */
export function briefText(i: BriefInput): string {
  const { model, rows, dock, today } = i;
  const all = i.all ?? rows;
  const over = overdueOf(all, today);
  const soon = dueWithin(all, today, 14);
  const filed = filedOf(rows);
  const fy = fyOf(today);
  const L: string[] = [];
  L.push(`${i.companyName}: status as of ${fmtL(today)}.`, '');

  if (model.steps.length) {
    const done = model.phases.filter((p) => p.state === 'done').map((p) => p.name);
    const active = model.phases.filter((p) => p.state === 'active').map((p) => p.name);
    const parts = [`Set-up: ${model.all.done} of ${model.all.total} steps done.`];
    if (done.length) parts.push(`${joinAnd(done)} ${done.length === 1 ? 'is' : 'are'} complete${active.length ? ';' : '.'}`);
    if (active.length) parts.push(`${joinAnd(active)} ${active.length === 1 ? 'is' : 'are'} under way.`);
    const ready = readyBy(model, today);
    if (ready) parts.push(`Expected to be fully registered by ${fmtL(ready)}.`);
    L.push(parts.join(' '), '');
  }

  L.push(
    over.length
      ? `Overdue (${over.length}): ${list(over.map((r) => `${r.name}${r.period ? ` for ${r.period}` : ''} was due on ${fmtL(r.dueDate)}${r.ownerName ? ` · ${r.ownerName} at SBC` : ''}`))}.`
      : 'Nothing is overdue.',
    '',
  );
  L.push(dock.length ? `Waiting on ${i.companyShort} (${dock.length}): ${list(dock.map((x) => x.title))}.` : `Nothing is waiting on ${i.companyShort}.`, '');
  if (soon.length) L.push(`Due in the next 14 days: ${list(soon.map((r) => `${r.name} (${fmt(r.dueDate)})`))}. SBC prepares and files these.`, '');
  const late = filed.filter((r) => r.filedOn! > r.dueDate).length;
  L.push(`Filed this financial year (${fy.label}): ${filed.length} filing${filed.length === 1 ? '' : 's'}${filed.length ? (late ? `, ${late} after the due date` : ', all on time') : ''}.`, '');
  const team = i.team.filter((t) => !t.support);
  if (team.length) L.push(`SBC team: ${team.map((t) => `${t.name} (${t.role})`).join(', ')}.`);
  return L.join('\n').trimEnd();
}

function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** "Good morning" by the hour in India. */
export function greeting(now: number = Date.now()): string {
  const h = new Date(now + 5.5 * 3600e3).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** A filing name for a tight label: the whole name when short ("DPT-3", "Advance tax Q2"), else its first word. */
export const shortName = (name: string): string => (name.length <= 16 ? name : name.split(' ')[0]!);

export function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}
