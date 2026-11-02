/**
 * AUDIT LOG — the pure half of the page: the live view's filters (search, role,
 * action type) plus the prototype's day filter, the 14-day strip, events grouped
 * by day, the facts behind "Details", the doors an event opens, the Stage filter
 * and the CSV export. No React, no fetch.
 */
import { getItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { IconName } from '@/components/portal/ui';
import {
  formatActorDisplay,
  formatAuditActionLabel,
  getAuditActionCategory,
  getAuditTargetType,
  type AuditActionCategory,
  type AuditEventRow,
} from '@/lib/audit-log';
import { ROLE_UI_LABEL, type DbRole } from '@/lib/auth';
import { stepSlugForItemId } from '@/lib/slug';
import { hhmmIst, istDayOf, sentenceCase, toCsv } from './fmt';

/** The live view's type labels (AuditLog.tsx CATEGORY_LABELS). */
export const CATEGORY_LABELS: Record<AuditActionCategory, string> = {
  engagement: 'Projects',
  checklist: 'Milestones',
  documents: 'Documents',
  admin: 'Team',
  email: 'Email',
  other: 'Other',
};
export const CATEGORY_ORDER: AuditActionCategory[] = ['engagement', 'checklist', 'documents', 'admin', 'email', 'other'];
export const CATEGORY_ICON: Record<AuditActionCategory, IconName> = {
  engagement: 'grid',
  checklist: 'check',
  documents: 'doc',
  admin: 'team',
  email: 'mail',
  other: 'hist',
};

/** The live role filter: All roles · Manager · Project lead · Client (exact `actor_role` match). */
export type WhoFilter = 'all' | DbRole;
export const WHO_OPTIONS: Array<[WhoFilter, string]> = [
  ['all', 'Everyone'],
  ['manager', 'Manager'],
  ['intern', 'Project lead'],
  ['client', 'Client'],
];

export interface AuditFilters {
  search: string;
  role: WhoFilter;
  category: 'all' | AuditActionCategory;
  /** '' = any day; else YYYY-MM-DD (India) */
  day: string;
}
export const NO_FILTERS: AuditFilters = { search: '', role: 'all', category: 'all', day: '' };

export const roleLabel = (role: string): string => sentenceCase(ROLE_UI_LABEL[role as DbRole] ?? role);

/** Live `filterEvents`, plus the day. `projectName(dbId)` → company name or undefined. */
export function filterEvents(events: AuditEventRow[], f: AuditFilters, projectName: (dbId: string) => string | undefined): AuditEventRow[] {
  const query = f.search.trim().toLowerCase();
  return events.filter((ev) => {
    if (f.role !== 'all' && ev.actor_role !== f.role) return false;
    if (f.category !== 'all' && getAuditActionCategory(ev.action) !== f.category) return false;
    if (f.day && istDayOf(ev.created_at) !== f.day) return false;
    if (!query) return true;
    const project = ev.engagement_id ? projectName(ev.engagement_id) ?? '' : '';
    const haystack = [
      ev.summary,
      ev.action,
      formatAuditActionLabel(ev.action),
      formatActorDisplay(ev),
      ev.actor_email ?? '',
      ev.actor_name ?? '',
      project,
      getAuditTargetType(ev.action),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Stage filter: events of clients in that stage only (events with no client drop out). */
export function inStage(events: AuditEventRow[], scope: 'all' | 'inc' | 'cmp', stageOf: (dbId: string) => 'inc' | 'cmp' | undefined): AuditEventRow[] {
  if (scope === 'all') return events;
  return events.filter((ev) => !!ev.engagement_id && stageOf(ev.engagement_id) === scope);
}

/** The last `n` days (oldest first) with their event counts. */
export function dayStrip(events: AuditEventRow[], today: string, n = 14): Array<{ day: string; n: number }> {
  const counts = new Map<string, number>();
  for (const e of events) {
    const d = istDayOf(e.created_at);
    if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const t0 = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(t0 - (n - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { day, n: counts.get(day) ?? 0 };
  });
}

/** Events (newest first) grouped by their India day, in order. */
export function groupByDay(events: AuditEventRow[]): Array<{ day: string; events: AuditEventRow[] }> {
  const out: Array<{ day: string; events: AuditEventRow[] }> = [];
  for (const ev of events) {
    const day = istDayOf(ev.created_at) ?? '';
    const last = out[out.length - 1];
    if (last && last.day === day) last.events.push(ev);
    else out.push({ day, events: [ev] });
  }
  return out;
}

export function facetCounts(events: AuditEventRow[]): { category: Record<string, number>; role: Record<string, number> } {
  const category: Record<string, number> = { all: events.length };
  const role: Record<string, number> = { all: events.length };
  for (const ev of events) {
    const c = getAuditActionCategory(ev.action);
    category[c] = (category[c] ?? 0) + 1;
    role[ev.actor_role] = (role[ev.actor_role] ?? 0) + 1;
  }
  return { category, role };
}

/** The live expand's metadata as text (origin/main `formatAuditMetadata`). */
export function formatAuditMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata || !Object.keys(metadata).length) return null;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

/** Every metadata key as a fact: "itemId" → "Item id". */
export function metadataFacts(metadata: Record<string, unknown> | null): Array<{ k: string; v: string }> {
  if (!metadata) return [];
  return Object.entries(metadata).map(([k, v]) => ({
    k: sentenceCase(k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')),
    v: v == null || v === '' ? '—' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : safeJson(v),
  }));
}
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export interface AuditLink {
  label: string;
  href: string;
  ico: IconName;
}

/** Where an event leads: its step, its client, the knowledge bank. */
export function eventLinks(ev: AuditEventRow, eng: Pick<Engagement, 'id' | 'slug'> | undefined, base: string): AuditLink[] {
  const out: AuditLink[] = [];
  const itemId = typeof ev.metadata?.itemId === 'string' ? (ev.metadata.itemId as string) : undefined;
  if (eng) {
    const client = `${base}/projects/${eng.slug ?? eng.id}`;
    if (itemId && getItem(itemId)) out.push({ label: 'Open step', href: `${client}/step/${stepSlugForItemId(itemId)}`, ico: 'step' });
    out.push({ label: 'Open client', href: client, ico: 'grid' });
  }
  if (ev.action.startsWith('knowledge_bank.')) out.push({ label: 'Open knowledge bank', href: `${base}/knowledge-bank`, ico: 'lib' });
  return out;
}

/** The project column, as the live view printed it. */
export function projectText(ev: AuditEventRow, projectName: (dbId: string) => string | undefined): string {
  if (!ev.engagement_id) return '';
  return projectName(ev.engagement_id) ?? 'Unknown project';
}

export function auditCsv(events: AuditEventRow[], projectName: (dbId: string) => string | undefined): string {
  const head = ['Date', 'Time', 'Type', 'Action', 'Summary', 'Who', 'Email', 'Role', 'Project', 'Target', 'Details', 'Action code'];
  const rows = events.map((ev) => [
    istDayOf(ev.created_at) ?? '',
    hhmmIst(ev.created_at),
    CATEGORY_LABELS[getAuditActionCategory(ev.action)],
    formatAuditActionLabel(ev.action),
    ev.summary,
    ev.actor_name?.trim() || ev.actor_email?.trim() || 'Unknown actor',
    ev.actor_email ?? '',
    roleLabel(ev.actor_role),
    projectText(ev, projectName),
    getAuditTargetType(ev.action),
    formatAuditMetadata(ev.metadata) ?? '',
    ev.action,
  ]);
  return toCsv([head, ...rows]);
}
