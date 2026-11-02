/**
 * SBC's statutory compliance calendar as portal filing rows (owner, 2026-10-29:
 * "the orbit has no data … whatever is on the website, it has to be here").
 *
 * A company with no filings on its register yet (before incorporation, or before
 * SBC generates its register) still has a compliance year ahead of it. The
 * prototype drew its orbit from the firm's compliance calendar filtered to the
 * client ("cal … mine"); this does the same with the tool's real calendar
 * (src/data/statutory-calendar-fy2627.ts, from SBC's "Compliance Calendar
 * 2026-27" PDF) and the tool's own applicability rule (`deadlineAppliesTo`).
 *
 * The rows are marked `fromCalendar`: they are what applies once the company is
 * set up, not filings SBC owes yet — never overdue, never filed, no reminder,
 * proof, window or walkthrough. Only deadlines from today onwards are returned.
 *
 * Pure: no db, no React.
 */
import { deadlineAppliesTo, STATUTORY_DEADLINES, type StatutoryAct, type StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import type { Engagement } from '@/data/engagements';
import type { AreaCode, PortalFiling } from './compliances';

const AREA: Record<StatutoryAct, AreaCode | null> = {
  GST: 'GST',
  IT: 'IT',
  TP: 'IT',
  MCA: 'MCA',
  FEMA: 'FEMA',
  'STPI/SEZ': 'FEMA',
  LABOUR: 'PAY',
  RERA: null,
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Authority code and name, as the register names them. */
function authorityOf(act: StatutoryAct, title: string): [string, string] {
  switch (act) {
    case 'GST':
      return ['GST', 'GSTN'];
    case 'IT':
    case 'TP':
      return ['IT', 'Income Tax Dept'];
    case 'MCA':
      return ['MCA', 'Ministry of Corporate Affairs'];
    case 'FEMA':
      return /Softex|STPI/i.test(title) ? ['STPI', 'STPI'] : ['RBI', 'Reserve Bank of India'];
    case 'STPI/SEZ':
      return /SEZ/i.test(title) && !/STPI/i.test(title) ? ['SEZ', 'SEZ authority'] : ['STPI', 'STPI'];
    case 'LABOUR':
      if (/PT\b|professional tax/i.test(title)) return ['PT', 'State commercial taxes'];
      if (/ESI/i.test(title) && !/PF/i.test(title)) return ['ESIC', 'ESIC'];
      if (/PF/i.test(title) && /ESI/i.test(title)) return ['EPFO', 'EPFO & ESIC'];
      return ['EPFO', 'EPFO'];
    default:
      return [act, act];
  }
}

/** How often a calendar line recurs (the prototype's freqOf, written for this same calendar). */
export function calendarFrequency(title: string): 'one-time' | 'quarterly' | 'half-yearly' | 'monthly' | 'annual' {
  if (/LUT|AGM for newly|MBP-1|Last date|Renewal|139\(8A\)|Revised|if pending/.test(title)) return 'one-time';
  if (/Q[1-4]\b|QPR|Apr–Jun|Jul–Sep|Oct–Dec|Jan–Mar|Advance tax|16A|27D|Form 121|TCS return|TDS return|MSME-1|Oct ’25/.test(title)) {
    return /MSME/.test(title) ? 'half-yearly' : 'quarterly';
  }
  if (/GSTR-1|GSTR-3B|Softex|PT payment$|PT payment(?! —)|PF and ESI|challan|MPR|ECB-2 monthly return|SERF/.test(title)) return 'monthly';
  return 'annual';
}

const FREQ_LABEL = { 'one-time': 'One-time', quarterly: 'Quarterly', 'half-yearly': 'Half-yearly', monthly: 'Monthly', annual: 'Annual' } as const;

/** The period a calendar line is for, worded like the register ("Sep 2026", "Jul–Sep 2026", "FY 2026-27"). */
export function calendarPeriod(d: StatutoryDeadline): string {
  const f = calendarFrequency(d.title);
  const due = new Date(d.date + 'T00:00:00Z');
  const y = due.getUTCFullYear();
  const m = due.getUTCMonth();
  if (f === 'monthly') {
    const p = new Date(Date.UTC(y, m - 1, 1));
    return `${MON[p.getUTCMonth()]} ${p.getUTCFullYear()}`;
  }
  if (f === 'quarterly') {
    // advance tax is paid for the quarter the due date falls in; returns for the quarter that ended before it
    const end = /Advance tax/i.test(d.title) ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, 1));
    const qEndMonth = end.getUTCMonth() - (end.getUTCMonth() % 3) + 2;
    const qEnd = new Date(Date.UTC(end.getUTCFullYear(), qEndMonth, 1));
    const qStart = new Date(Date.UTC(qEnd.getUTCFullYear(), qEnd.getUTCMonth() - 2, 1));
    return `${MON[qStart.getUTCMonth()]}–${MON[qEnd.getUTCMonth()]} ${qEnd.getUTCFullYear()}`;
  }
  if (f === 'half-yearly') return m >= 9 ? `Apr–Sep ${y}` : `Oct ${y - 1} – Mar ${y}`;
  if (f === 'one-time') return 'One-time';
  // annual returns are filed for the year before: due Apr–Dec 2026 → FY 2025-26; due Jan–Mar 2027 → FY 2026-27
  const fyStart = y - 1;
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

/**
 * The last day of the period a calendar line covers (monthly: the month before
 * the due month; quarterly: that quarter's end; half-yearly: 30 Sep / 31 Mar;
 * annual: 31 Mar of the year it is for; one-time: the due date itself).
 * A company that did not exist by then never owes that line.
 */
export function calendarPeriodEnd(d: StatutoryDeadline): string {
  // a line that names the year it covers: "FY 2025-26" ends 31 Mar 2026; "AY 2026-27" is FY 2025-26
  const fy = /\bFY\s?(\d{4})\s?-\s?(\d{2})\b/.exec(d.title);
  if (fy) return `${Number(fy[1]) + 1}-03-31`;
  const ay = /\bAY\s?(\d{4})\s?-\s?(\d{2})\b/.exec(d.title);
  if (ay) return `${Number(ay[1])}-03-31`;
  const f = calendarFrequency(d.title);
  const due = new Date(d.date + 'T00:00:00Z');
  const y = due.getUTCFullYear();
  const m = due.getUTCMonth();
  // the first AGM due this year is for companies incorporated in the year that ended last March
  if (/newly incorporated/i.test(d.title)) return `${m >= 3 ? y : y - 1}-03-31`;
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0)).toISOString().slice(0, 10);
  if (f === 'monthly') return lastDay(y, m - 1);
  if (f === 'quarterly') {
    const end = /Advance tax/i.test(d.title) ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, 1));
    const qEndMonth = end.getUTCMonth() - (end.getUTCMonth() % 3) + 2;
    return lastDay(end.getUTCFullYear(), qEndMonth);
  }
  if (f === 'half-yearly') return m >= 9 ? `${y}-09-30` : `${y}-03-31`;
  if (f === 'one-time') return d.date;
  return `${y}-03-31`;
}

/** The short form name: the first item of a combined line ("GSTR-3B; GSTR-5A (OIDAR)" → "GSTR-3B"). */
export function calendarName(title: string): string {
  return title.split(';')[0]!.trim();
}

/**
 * The calendar deadlines that apply to this company, from `today` to the end of
 * the financial year that starts in April `fyStartYear`, as portal filing rows.
 * `existsFrom` is the incorporation date (real, else SBC's expected or projected
 * one): a line whose period ended before it is left out — a company that did not
 * exist in that month, quarter or year never files for it.
 */
export function statutoryFilings(engagement: Engagement, fyStartYear: number, today: string, existsFrom?: string): PortalFiling[] {
  const from = `${fyStartYear}-04-01`;
  const to = `${fyStartYear + 1}-03-31`;
  const fyLabel = `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
  const out: PortalFiling[] = [];
  for (const d of STATUTORY_DEADLINES) {
    if (d.date < from || d.date > to || d.date < today) continue;
    // nothing due before the company exists, and nothing for a period that ended before it existed
    if (existsFrom && (d.date < existsFrom.slice(0, 10) || calendarPeriodEnd(d) < existsFrom.slice(0, 10))) continue;
    const area = AREA[d.act];
    if (!area || !deadlineAppliesTo(d, engagement)) continue;
    const [authority, authorityName] = authorityOf(d.act, d.title);
    const frequency = calendarFrequency(d.title);
    out.push({
      id: `cal:${d.id}`,
      engagementId: engagement.id,
      companyName: engagement.companyName,
      particular: d.title,
      name: calendarName(d.title),
      area,
      authority,
      authorityName,
      frequency,
      freqLabel: FREQ_LABEL[frequency],
      dueDate: d.date,
      filedOn: null,
      period: calendarPeriod(d),
      periodLong: null,
      fyLabel,
      rawStatus: 'calendar',
      windowFrom: null,
      windowTo: null,
      penaltyRisk: '',
      ownerName: null,
      acknowledgementNo: null,
      amountPaid: null,
      filedByName: null,
      dataReceivedOn: null,
      preparingSince: null,
      draftDueOn: null,
      approvalDueOn: null,
      approvedOn: null,
      proofCount: 0,
      reminderOn: null,
      fromCalendar: true,
    });
  }
  return out;
}
