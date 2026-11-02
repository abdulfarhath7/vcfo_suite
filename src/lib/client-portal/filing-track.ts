/**
 * CLIENT PORTAL · FILING TRACK — pure view-model for one filing's card and
 * walkthrough in the redesigned portal (prototype a1_core.js filingCard /
 * flowFor / flowStates, a6_rest.js openWizardFor), built ONLY from the real
 * register row: the focus-track dates SBC records (data received, preparing
 * since, draft due, approval due, approved on) and the filed date.
 *
 * Also the Filings section's period model (Monthly / Quarterly / Annual over
 * an Indian financial year) and the timeline's per-day groups.
 * No React, no db.
 */
import {
  MON,
  MONTHS,
  daysBetween,
  fmtDMY,
  fyLabelOf,
  fyMonths,
  fyStartOfMonth,
  portalFor,
  statusOf,
  type CompStatus,
  type PortalFiling,
} from './compliances';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtL = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${fmtDMY(iso)}`;
};

/* ------------------------------------------------------------------ track */

export type TrackWho = 'YOU' | 'SBC';
export type TrackState = 'done' | 'now' | 'stuck' | 'up';
export type TrackKey = 'data' | 'prepare' | 'draft' | 'approve' | 'file';

export interface FilingTrackStep {
  key: TrackKey;
  who: TrackWho;
  title: string;
  body: string;
  state: TrackState;
  /** why it is stuck (overdue) */
  sub?: string;
}

type TrackRow = Pick<
  PortalFiling,
  | 'name'
  | 'period'
  | 'area'
  | 'dueDate'
  | 'filedOn'
  | 'rawStatus'
  | 'ownerName'
  | 'filedByName'
  | 'acknowledgementNo'
  | 'dataReceivedOn'
  | 'preparingSince'
  | 'draftDueOn'
  | 'approvalDueOn'
  | 'approvedOn'
>;

/** Has SBC recorded any work on this filing yet? */
export function hasTrack(f: TrackRow): boolean {
  return Boolean(f.dataReceivedOn || f.preparingSince || f.draftDueOn || f.approvalDueOn || f.approvedOn);
}

/**
 * The five steps of a filing: you send the data → SBC prepares → SBC sends the
 * draft → you approve → SBC files. Done-ness comes only from recorded dates
 * (same rules as `focusNodes` in compliances.ts). The first open step is "now"
 * ("stuck" when the filing is overdue); a filing that is not due soon and has
 * no recorded work yet shows every step as not started.
 */
export function filingTrack(f: TrackRow, companyShort: string, today: string): FilingTrackStep[] {
  const filed = Boolean(f.filedOn);
  const approved = filed || Boolean(f.approvedOn);
  const draftSent = Boolean(f.draftDueOn) && f.draftDueOn! < today && f.rawStatus !== 'in-progress';
  const prepDone = approved || draftSent;
  const dataDone = prepDone || Boolean(f.dataReceivedOn) || Boolean(f.preparingSince);
  const who = f.ownerName ?? 'Your SBC team';
  const [portal] = portalFor(f);
  const co = companyShort || 'Your company';

  const base: Omit<FilingTrackStep, 'state'>[] = [
    {
      key: 'data',
      who: 'YOU',
      title: 'Send SBC the data',
      body: dataDone
        ? `SBC has the data for ${f.period}${f.dataReceivedOn ? ` since ${fmtDMY(f.dataReceivedOn)}` : ''}.`
        : `SBC needs your records for ${f.period} to prepare ${f.name}. Send them through Documents or reply to SBC's request.`,
    },
    {
      key: 'prepare',
      who: 'SBC',
      title: 'SBC prepares the filing',
      body: prepDone
        ? `${who} prepared ${f.name} for ${f.period}.`
        : `${who} prepares ${f.name} for ${f.period}${f.preparingSince ? `, in progress since ${fmtDMY(f.preparingSince)}` : ''}.`,
    },
    {
      key: 'draft',
      who: 'SBC',
      title: 'SBC sends you the draft',
      body: f.draftDueOn
        ? draftSent || approved
          ? `The draft was due to you on ${fmtDMY(f.draftDueOn)}.`
          : `The draft comes to you by ${fmtDMY(f.draftDueOn)}.`
        : 'SBC shares the figures with you before anything is filed.',
    },
    {
      key: 'approve',
      who: 'YOU',
      title: `${co} approves the figures`,
      body: f.approvedOn
        ? `Approved on ${fmtDMY(f.approvedOn)}.`
        : f.approvalDueOn
          ? `Approve by ${fmtDMY(f.approvalDueOn)} so SBC can file on time.`
          : 'You check the figures and approve them before SBC files.',
    },
    {
      key: 'file',
      who: 'SBC',
      title: `SBC files on the ${portal}`,
      body: filed
        ? `Filed on ${fmtDMY(f.filedOn!)}${f.filedByName ? ` by ${f.filedByName}` : ''}${f.acknowledgementNo ? ` · reference ${f.acknowledgementNo}` : ''}.`
        : `Due ${fmtL(f.dueDate)}. The acknowledgement is saved as proof once it is filed.`,
    },
  ];
  const done = [dataDone, prepDone, prepDone, approved, filed];
  if (filed) return base.map((s) => ({ ...s, state: 'done' }));
  const st = statusOf(f, today);
  const cur = done.findIndex((d) => !d);
  const started = st === 'over' || st === 'due' || hasTrack(f);
  const late = -daysBetween(today, f.dueDate);
  return base.map((s, i) => {
    if (done[i]) return { ...s, state: 'done' };
    if (i !== cur || !started) return { ...s, state: 'up' };
    if (st === 'over') return { ...s, state: 'stuck', sub: `It was due ${fmtL(f.dueDate)}, ${late} day${late === 1 ? '' : 's'} ago.` };
    return { ...s, state: 'now' };
  });
}

/** WHO ACTS on the card. */
export function whoActs(f: TrackRow, steps: FilingTrackStep[]): string {
  if (f.filedOn) return f.filedByName ? `${f.filedByName} · SBC` : 'SBC';
  const cur = steps.find((s) => s.state !== 'done');
  return cur?.who === 'YOU' ? 'You, then SBC' : 'SBC';
}

/** The penalty line (unfiled filings only), from the register's penalty risk. */
export function penaltyLine(f: Pick<PortalFiling, 'filedOn' | 'dueDate' | 'penaltyRisk'>, today: string): string | null {
  if (f.filedOn) return null;
  const late = -daysBetween(today, f.dueDate);
  const lead = late > 0 ? `${late} day${late === 1 ? '' : 's'} late. ` : '';
  const r = f.penaltyRisk.trim().toLowerCase();
  if (r === 'high') return `${lead}High penalty risk: late fees and interest can run from the day after the due date.`;
  if (r === 'medium') return `${lead}Medium penalty risk: a late fee can apply after the due date.`;
  if (r === 'low') return `${lead}Low penalty risk, but a late filing is still on record.`;
  return lead ? `${lead}A late fee can apply.` : null;
}

/** One-paragraph "what this is" for the walkthrough summary. */
export function filingWhat(f: Pick<PortalFiling, 'name' | 'period' | 'freqLabel' | 'authorityName'>): string {
  const fq = f.freqLabel && f.freqLabel !== '—' ? f.freqLabel.toLowerCase() : '';
  const a = fq ? (/^[aeiou]/.test(fq) ? 'an' : 'a') : 'a';
  return `${f.name} for ${f.period} is ${a} ${fq ? fq + ' ' : ''}filing with the ${f.authorityName}. You send the data and approve the figures; SBC prepares it, files it and saves the acknowledgement as proof.`;
}

/* ------------------------------------------------------------------ periods (Filings section) */

export type Gran = 'month' | 'quarter' | 'year';
export interface FPeriod {
  gran: Gran;
  /** FY start year (2026 = FY 2026-27) */
  fy: number;
  /** month 0–11 (Apr = 0) · quarter 0–3 · 0 for the year */
  idx: number;
}
const COUNT: Record<Gran, number> = { month: 12, quarter: 4, year: 1 };

/** The period of `gran` that contains `today`. */
export function periodAt(gran: Gran, today: string): FPeriod {
  const fy = fyStartOfMonth(today.slice(0, 7));
  const mi = fyMonths(fy).indexOf(today.slice(0, 7));
  return { gran, fy, idx: gran === 'month' ? mi : gran === 'quarter' ? Math.floor(mi / 3) : 0 };
}
/** YYYY-MM keys the period covers. */
export function periodMonths(p: FPeriod): string[] {
  const m = fyMonths(p.fy);
  if (p.gran === 'month') return [m[p.idx]!];
  if (p.gran === 'quarter') return m.slice(p.idx * 3, p.idx * 3 + 3);
  return m;
}
export function periodRange(p: FPeriod): { from: string; to: string } {
  const ms = periodMonths(p);
  const last = ms[ms.length - 1]!;
  const [y, m] = last.split('-').map(Number) as [number, number];
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ms[0]}-01`, to: `${last}-${String(end).padStart(2, '0')}` };
}
const QN = ['Q1 · Apr–Jun', 'Q2 · Jul–Sep', 'Q3 · Oct–Dec', 'Q4 · Jan–Mar'];
export function periodLabel(p: FPeriod): string {
  if (p.gran === 'month') {
    const [y, m] = periodMonths(p)[0]!.split('-');
    return `${MONTHS[Number(m) - 1]} ${y}`;
  }
  if (p.gran === 'quarter') return `${QN[p.idx]} ${p.idx === 3 ? p.fy + 1 : p.fy}`;
  return `Full year · April ${p.fy} to March ${p.fy + 1}`;
}
/** Short head for the status card: "October 2026", "Q3", "FY 2026-27". */
export function periodShort(p: FPeriod): string {
  if (p.gran === 'year') return fyLabelOf(p.fy);
  return periodLabel(p).split(' · ')[0]!;
}
/** Move `k` periods, crossing financial years. */
export function stepPeriod(p: FPeriod, k: number): FPeriod {
  const n = COUNT[p.gran];
  const t = p.fy * n + p.idx + k;
  return { gran: p.gran, fy: Math.floor(t / n), idx: ((t % n) + n) % n };
}
export function inPeriod(p: FPeriod, dueDate: string): boolean {
  const { from, to } = periodRange(p);
  return dueDate >= from && dueDate <= to;
}
export function periodFile(p: FPeriod): string {
  if (p.gran === 'year') return fyLabelOf(p.fy).replace(/\s+/g, '-');
  if (p.gran === 'quarter') return `${fyLabelOf(p.fy).replace(/\s+/g, '-')}-Q${p.idx + 1}`;
  return periodMonths(p)[0]!;
}

/* ------------------------------------------------------------------ calendar helpers */

const RANK: Record<CompStatus, number> = { over: 0, due: 1, up: 2, ok: 3 };

/** Worst status of a list (over > due > up > ok); `ok` for an empty list. */
export function worstOf(rows: Pick<PortalFiling, 'filedOn' | 'dueDate'>[], today: string): CompStatus {
  return rows.reduce<CompStatus>((w, r) => {
    const s = statusOf(r, today);
    return RANK[s] < RANK[w] ? s : w;
  }, 'ok');
}
/** Sort by status (overdue first), then name. */
export function byStatus<T extends PortalFiling>(rows: T[], today: string): T[] {
  return [...rows].sort((a, b) => RANK[statusOf(a, today)] - RANK[statusOf(b, today)] || a.name.localeCompare(b.name));
}

export interface DayGroup<T> {
  d: string;
  items: T[];
  lead: T;
  st: CompStatus;
}
/** Filings grouped per due date (one dot per day on the timeline). */
export function groupsByDay<T extends PortalFiling>(rows: T[], today: string): DayGroup<T>[] {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = r.dueDate.slice(0, 10);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, items]) => {
      const sorted = byStatus(items, today);
      return { d, items: sorted, lead: sorted[0]!, st: worstOf(sorted, today) };
    });
}

/** "Oct" for a YYYY-MM key. */
export const monShort = (key: string): string => MON[Number(key.slice(5, 7)) - 1]!;

/** First and last FY (start years) worth navigating: the register's span, always including the current FY and the next. */
export function fyRange(rows: Pick<PortalFiling, 'dueDate'>[], curFy: number): { lo: number; hi: number } {
  let lo = curFy;
  let hi = curFy + 1;
  for (const r of rows) {
    const f = fyStartOfMonth(r.dueDate.slice(0, 7));
    if (f < lo) lo = f;
    if (f > hi) hi = f;
  }
  return { lo, hi };
}
