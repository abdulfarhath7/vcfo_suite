/**
 * Updates (bell, megaphone, Announcements, Notifications, Regulatory updates,
 * Ask VCFO) — the pure rules, kept apart from React so they can be tested:
 * India-time labels, what each notification kind looks like, where an old
 * staff link goes in the console, the next filing deadline, and the review
 * queue's states.
 */
import { notificationDirection, type AppNotification, type NotificationKind } from '@/lib/checklist/checklist-notifications';
import { isCreatedAtIstToday, isCreatedAtThisIstWeek } from '@/lib/notifications/notification-dismiss';
import type { AnnouncementKind } from '@/lib/notifications/announcements';
import type { FilingRow } from '@/lib/compliance/filings';
import type { IconName, LawKey } from '@/components/portal/ui';

/* ================================================================ dates (India time) */

const IST_MS = 5.5 * 3600e3;
const DAY_MS = 864e5;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The India calendar day (YYYY-MM-DD) of a timestamp, or of a plain day. */
export function istDay(v: string | null | undefined): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

/** Today in India, from an epoch time. */
export function istToday(now: number): string {
  return new Date(now + IST_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** "16 Oct" this year, "16 Oct 2025" otherwise. */
export function dLabel(day: string, today: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  const base = `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  return day.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${d.getUTCFullYear()}`;
}

/** "Fri 16 Oct" (this year) — where the weekday matters. */
export function dDayLabel(day: string, today: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return `${WD[d.getUTCDay()]} ${dLabel(day, today)}`;
}

/** "2:30 pm", India time. */
export function tLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t + IST_MS);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

/** A list row's time: "Just now", "12m ago", "2:30 pm" (today), "Yesterday", "16 Oct". */
export function whenLabel(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = now - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const day = istDay(iso)!;
  const today = istToday(now);
  if (day === today) return tLabel(iso);
  if (dayDiff(day, today) === 1) return 'Yesterday';
  return dLabel(day, today);
}

/** The reader's full stamp: "Fri 16 Oct 2026, 2:30 pm IST". */
export function stampLabel(iso: string): string {
  const day = istDay(iso);
  if (!day) return '';
  const d = new Date(`${day}T00:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${tLabel(iso)} IST`;
}

/** "16 Oct, 2:30 pm" (this year) for a found / decided time. */
export function shortStamp(iso: string | null | undefined, now: number): string {
  const day = istDay(iso ?? '');
  if (!day || !iso) return '';
  return `${dLabel(day, istToday(now))}, ${tLabel(iso)}`;
}

/** Date tile parts (day number, month) of a timestamp, in India time. */
export function dayTile(iso: string): { d: string; mon: string } {
  const day = istDay(iso);
  if (!day) return { d: '–', mon: '' };
  const d = new Date(`${day}T00:00:00Z`);
  return { d: String(d.getUTCDate()), mon: MON[d.getUTCMonth()]! };
}

/** Bell grouping (live NotificationsBell): Today / Yesterday / Earlier, in India time. */
export function bellDay(iso: string, now: number): 'Today' | 'Yesterday' | 'Earlier' {
  const day = istDay(iso);
  if (!day) return 'Earlier';
  const gap = dayDiff(day, istToday(now));
  if (gap <= 0) return 'Today';
  if (gap === 1) return 'Yesterday';
  return 'Earlier';
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/* ================================================================ notification kinds */

/** The five groups the Notifications page sorts kinds into (the prototype's type tabs, on real kinds). */
export type NoteType = 'steps' | 'docs' | 'team' | 'official' | 'email';
export const NOTE_TYPES: NoteType[] = ['steps', 'docs', 'team', 'official', 'email'];
export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  steps: 'Steps',
  docs: 'Documents',
  team: 'Team',
  official: 'Official updates',
  email: 'Email sent',
};
/** Category colours: none of the status colours (red, amber, green, teal), so a type is never read as a state. */
export const NOTE_TYPE_COLOR: Record<NoteType, string> = {
  steps: 'var(--mx-run)',
  docs: 'var(--mx-wait)',
  team: 'var(--c-BR)',
  official: 'var(--c-KH)',
  email: 'var(--ink-3)',
};

export interface NoteMeta {
  type: NoteType;
  icon: IconName;
  /** pill class: due = waits for you, over = failed, ok = done, mut = for information */
  tone: 'due' | 'over' | 'ok' | 'mut';
  /** what the kind means, for the icon's and the pill's tooltip */
  what: string;
}

export const NOTE_META: Record<NotificationKind, NoteMeta> = {
  'checklist.submit': { type: 'steps', icon: 'step', tone: 'due', what: 'A step was submitted and waits for a review' },
  'checklist.review': { type: 'steps', icon: 'check', tone: 'mut', what: 'A step was accepted or sent back' },
  'checklist.deliver': { type: 'steps', icon: 'send', tone: 'mut', what: 'A step was delivered to the client' },
  'checklist.unlock': { type: 'steps', icon: 'lock', tone: 'mut', what: 'A step was opened again for changes' },
  'docs.share': { type: 'docs', icon: 'folder', tone: 'mut', what: 'Documents were shared with the client' },
  'request.created': { type: 'docs', icon: 'doc', tone: 'mut', what: 'A document was requested' },
  'request.uploaded': { type: 'docs', icon: 'up', tone: 'mut', what: 'A client uploaded a document' },
  'team.assigned': { type: 'team', icon: 'team', tone: 'mut', what: 'You were added to a project team' },
  'team.removed': { type: 'team', icon: 'team', tone: 'mut', what: 'You were taken off a project team' },
  'message.received': { type: 'docs', icon: 'doc', tone: 'due', what: 'A client sent a message on a project' },
  'schedule.window': { type: 'steps', icon: 'step', tone: 'due', what: 'A date change request waits for a decision' },
  'compliance.reminder': { type: 'steps', icon: 'bell', tone: 'due', what: 'A compliance item is due soon or overdue' },
  'compliance.task': { type: 'steps', icon: 'check', tone: 'mut', what: 'A compliance task was assigned or changed' },
  'board.meeting': { type: 'steps', icon: 'team', tone: 'due', what: 'A board meeting needs a notice, an approval or its minutes' },
  'email.sent': { type: 'email', icon: 'send', tone: 'ok', what: 'An email the tool sent for you' },
  'email.skipped': { type: 'email', icon: 'mail', tone: 'mut', what: 'An email the tool did not send' },
  'email.failed': { type: 'email', icon: 'alert', tone: 'over', what: 'An email that could not be sent' },
  'regulatory.review': { type: 'official', icon: 'globe', tone: 'due', what: 'An official update waits for your review' },
  'regulatory.approved': { type: 'official', icon: 'mega', tone: 'mut', what: 'An official update was approved and posted' },
};

const FALLBACK_META: NoteMeta = { type: 'steps', icon: 'bell', tone: 'mut', what: 'An update on a client' };

export function noteMeta(kind: NotificationKind | string): NoteMeta {
  return NOTE_META[kind as NotificationKind] ?? FALLBACK_META;
}

export function isSent(n: Pick<AppNotification, 'kind'>): boolean {
  return notificationDirection(n.kind) === 'sent';
}

/** Notifications page filters (live history: direction and date; prototype: unread and type). */
export type NoteTab = 'all' | 'unread' | 'received' | 'sent';
export type NoteRange = 'any' | 'today' | 'week' | 'earlier';

export function matchesNoteFilters(
  n: AppNotification,
  f: { tab: NoteTab; type: NoteType | 'any'; range: NoteRange },
  now: Date,
): boolean {
  const sent = isSent(n);
  if (f.tab === 'unread' && n.read) return false;
  if (f.tab === 'received' && sent) return false;
  if (f.tab === 'sent' && !sent) return false;
  if (f.type !== 'any' && noteMeta(n.kind).type !== f.type) return false;
  if (f.range === 'today' && !isCreatedAtIstToday(n.createdAt, now)) return false;
  if (f.range === 'week' && !isCreatedAtThisIstWeek(n.createdAt, now)) return false;
  if (f.range === 'earlier' && isCreatedAtThisIstWeek(n.createdAt, now)) return false;
  return true;
}

/** Notifications that arrived this India month, by type (the Notifications page donut). */
export function typeCountsThisMonth(items: AppNotification[], now: number): Record<NoteType, AppNotification[]> {
  const month = istToday(now).slice(0, 7);
  const out: Record<NoteType, AppNotification[]> = { steps: [], docs: [], team: [], official: [], email: [] };
  for (const n of items) {
    if (istDay(n.createdAt)?.slice(0, 7) !== month) continue;
    out[noteMeta(n.kind).type].push(n);
  }
  return out;
}

/** Live bell copy for a clear with Undo. */
export function clearCopy(scope: 'today' | 'week' | 'all', count: number, tab: 'received' | 'sent'): string {
  if (count === 1) return 'Notification cleared';
  if (scope === 'today') return `Cleared ${count} from today`;
  if (scope === 'week') return `Cleared ${count} from this week`;
  return `Cleared ${count} ${tab} notifications`;
}

/* ================================================================ links: old staff routes → the console */

const EXTERNAL = /^https?:\/\//i;

/**
 * Where a notification's link goes inside the console seat (`base`, e.g.
 * '/app/manager'). Notifications store the link of the role that received
 * them, and a few go to another seat's page (an approved official update
 * links every staff member to '/app/admin/announcements'). Any
 * '/app/intern|manager|admin|super/…' link is moved onto the current seat;
 * a lead's project pages are '/engagements/…', a manager's or admin's
 * '/projects/…'. Absolute links to the app become paths; other sites stay as
 * they are. '' and '#' have nowhere to go.
 */
export function consoleHref(href: string | null | undefined, base: string): string | null {
  const raw = (href ?? '').trim();
  if (!raw || raw === '#') return null;
  let path = raw;
  if (EXTERNAL.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (!url.pathname.startsWith('/app/')) return raw;
    path = `${url.pathname}${url.search}${url.hash}`;
  }
  const m = /^\/app\/(intern|manager|admin|super)(?=$|[/?#])(.*)$/.exec(path);
  if (!m) return path;
  let rest = m[2] ?? '';
  if (base === '/app/intern') rest = rest.replace(/^\/projects(?=$|[/?#])/, '/engagements');
  else rest = rest.replace(/^\/engagements(?=$|[/?#])/, '/projects');
  return `${base}${rest}`;
}

export function isExternalHref(href: string): boolean {
  return EXTERNAL.test(href);
}

/** The button text for where a link goes. */
export function openLabel(path: string): string {
  const p = path.split(/[?#]/)[0] ?? '';
  if (EXTERNAL.test(path)) return 'Open the page';
  if (/\/(projects|engagements)\/[^/]+\/step\//.test(p)) return 'Open the step';
  if (/\/(projects|engagements)\/[^/]+\/board-resolution/.test(p)) return 'Open the board resolution';
  if (/\/(projects|engagements)\/[^/]+\/documents/.test(p)) return 'Open the documents';
  if (/\/(projects|engagements)\/[^/]+/.test(p)) return 'Open the client';
  if (/\/regulatory-updates$/.test(p)) return 'Open the review queue';
  if (/\/announcements$/.test(p)) return 'Open announcements';
  if (/\/approvals$/.test(p)) return 'Open approvals';
  if (/\/tasks$/.test(p)) return 'Open tasks';
  if (/\/mail$/.test(p)) return 'Open email';
  return 'Open';
}

/* ================================================================ announcements */

/** Important = Deadline and Compliance (live: there is no `important` kind). */
export function isImportantKind(kind: AnnouncementKind): boolean {
  return kind === 'deadline' || kind === 'compliance';
}

/**
 * How a kind is marked: an area of law keeps its law colour (MCA, GST, Income
 * tax, as on every console page); Deadline and Compliance are amber (needs
 * you); the rest are plain.
 */
export type AnnMark = { law: LawKey; text: string } | { tone: 'due' | 'mut'; text: string };
const ANN_LAW: Partial<Record<AnnouncementKind, LawKey>> = { mca: 'MCA', gst: 'GST', tax: 'IT' };

export function annMark(kind: AnnouncementKind, label: string): AnnMark {
  const law = ANN_LAW[kind];
  if (law) return { law, text: label };
  return { tone: isImportantKind(kind) ? 'due' : 'mut', text: label };
}

/** The colour of a card's top edge. */
export function annStripe(kind: AnnouncementKind): string {
  const law = ANN_LAW[kind];
  if (law) return `var(--law-${law})`;
  return isImportantKind(kind) ? 'var(--due)' : 'var(--line)';
}

/* ================================================================ next filing deadline */

export interface NextDeadline {
  due: string;
  days: number;
  name: string;
  period: string | null;
  companies: string[];
}

/**
 * The next filing still to be made, from the register: the earliest due day
 * from today on, with every client that owes the same filing that day.
 */
export function nextDeadline(rows: FilingRow[], today: string): NextDeadline | null {
  const open = rows
    .filter((r) => !r.filedOn?.trim() && r.dueDate && r.dueDate.slice(0, 10) >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.particular.localeCompare(b.particular));
  const first = open[0];
  if (!first) return null;
  const due = first.dueDate.slice(0, 10);
  const same = open.filter((r) => r.dueDate.slice(0, 10) === due && r.particular === first.particular);
  return {
    due,
    days: dayDiff(today, due),
    name: first.particular,
    period: first.periodLabel,
    companies: [...new Set(same.map((r) => r.companyName))],
  };
}

/** Filings past their due day and not made. */
export function overdueFilings(rows: FilingRow[], today: string): FilingRow[] {
  return rows.filter((r) => !r.filedOn?.trim() && r.dueDate && r.dueDate.slice(0, 10) < today);
}

/* ================================================================ regulatory review queue */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface RegUpdate {
  id: string;
  title: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  summary: string | null;
  status: string;
  error: string | null;
  reviewStatus: ReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  hasReviewPdf: boolean;
  chunkCount: number;
  createdAt: string;
  feed: { label: string; act: string } | null;
}

/** The watcher has the document but its review copy is not made yet (live wording: "still being read"). */
export function stillReading(u: Pick<RegUpdate, 'status' | 'hasReviewPdf'>): boolean {
  return u.status === 'processing' || (!u.hasReviewPdf && u.status === 'ready');
}

/** Approve and Reject show only for a manager, on a ready update that waits (live rule). */
export function decidable(u: Pick<RegUpdate, 'status' | 'hasReviewPdf' | 'reviewStatus'>, canDecide: boolean): boolean {
  return canDecide && u.reviewStatus === 'pending' && u.status === 'ready' && !stillReading(u);
}

/** The live page polls every 5 s while any update is still being read. */
export function needsPolling(updates: Array<Pick<RegUpdate, 'status' | 'hasReviewPdf'>> | undefined): boolean {
  return Boolean(updates?.some((u) => u.status === 'processing' || !u.hasReviewPdf));
}

/** "published 16 Oct" from the stored day (or the stored text when it is not a day). */
export function publishedLabel(v: string | null, now: number): string {
  if (!v?.trim()) return '';
  const day = /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
  return day ? dLabel(day, istToday(now)) : v.trim();
}

/** Seats whose role may read the review queue (live API: manager, admin, super admin). */
export function canSeeRegulatory(role: string | null | undefined): boolean {
  return role === 'manager' || role === 'admin' || role === 'super_admin';
}
