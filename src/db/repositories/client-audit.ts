import 'server-only';

import { and, desc, eq, gte, inArray, like, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess, getMyEngagement } from '@/db/repositories/engagements';
import { checklistItemLabel, formatAuditActionLabel } from '@/lib/audit/audit-log';
import {
  auditResultWord,
  istParts,
  type AuditCategory,
  type AuditNode,
  type AuditRoleLabel,
  type ClientAuditEvent,
  type ClientAuditPage,
  type ClientAuditSummary,
} from '@/lib/client-portal/audit';

/**
 * CLIENT AUDIT REPOSITORY (client portal v7 — Audit page).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Client role only. Scope = the caller's OWN engagement (`getMyEngagement` +
 * `assertEngagementAccess`); no caller-supplied engagement id exists.
 * Only client-visible actions are returned (allowlist below). The projection
 * drops `actor_email`, every id and the raw metadata (owner decision: SBC staff
 * by name and role only); summaries are scrubbed of e-mail addresses.
 */

export class ClientAuditError extends Error {
  constructor(
    message: string,
    public status: 403 | 404 = 404,
  ) {
    super(message);
  }
}

const PREFIXES = ['checklist.', 'incorporation_docs.', 'doc_pack.', 'document_request.', 'client.', 'welcome_email.', 'credentials.'];
const EXACT = ['board_resolution.finalize', 'email_templates.fire', 'engagement.checklist.submit', 'project.client_changed'];

/** The SQL form of the client allowlist, shared with `listAuditEvents` for the client role. */
export function clientVisibleAuditPredicate() {
  return allowed();
}

function allowed() {
  return or(...PREFIXES.map((p) => like(auditEvents.action, `${p}%`)), inArray(auditEvents.action, EXACT));
}

async function myEngagementDbId(ctx: AuthContext): Promise<{ dbId: string; company: string }> {
  if (ctx.role !== 'client') throw new ClientAuditError('The client audit is for clients', 403);
  const mine = await getMyEngagement(ctx);
  if (!mine) throw new ClientAuditError('No engagement found');
  const access = await assertEngagementAccess(ctx, mine.id);
  if (!access.ok) throw new ClientAuditError('No engagement found');
  return { dbId: access.dbId, company: access.row.companyName };
}

/** Plain words for the audit verbs (prototype: "Step accepted", not "Checklist · Save"). */
const CHECKLIST_LABEL: Record<string, string> = {
  save: 'Step saved',
  submit: 'Step submitted',
  accept: 'Step accepted',
  approve: 'Step accepted',
  complete: 'Step accepted',
  review: 'Step reviewed',
  unlock: 'Step reopened',
  reopen: 'Step reopened',
};
const TIMELINE_LABEL: Record<string, string> = {
  'client.timeline_change_request': 'Change request sent',
  'client.timeline_change_request_withdrawn': 'Change request withdrawn',
  'client.timeline_change_approved': 'Timeline change approved',
  'client.timeline_change_rejected': 'Timeline change declined',
};
const CREDENTIALS_LABEL: Record<string, string> = {
  otp_requested: 'Code requested',
  otp: 'Code verified',
  otp_locked: 'Code attempts locked',
  reveal: 'Values revealed',
  preview: 'Row previewed',
  lock: 'Values hidden',
  edit: 'Credentials edited',
  cell_updated: 'Credential updated',
  row_added: 'Row added',
  row_removed: 'Row removed',
  undo: 'Change undone',
};

const EMAIL_RE = /[^\s<>()@,;:]+@[^\s<>()@,;:]+\.[a-z]{2,}/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** A client may see this audit action (same allowlist as the Audit page). */
export function isClientVisibleAuditAction(action: string): boolean {
  return PREFIXES.some((p) => action.startsWith(p)) || EXACT.includes(action);
}

/** Client-safe text: e-mail addresses and ids removed. */
export function scrubForClient(s: string): string {
  return scrub(s);
}

function scrub(s: string): string {
  return s.replace(EMAIL_RE, 'a colleague').replace(UUID_RE, '').replace(/\s{2,}/g, ' ').trim();
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

function roleLabel(role: string): { role: AuditRoleLabel; side: 'sbc' | 'client' } {
  if (role === 'client') return { role: 'Client', side: 'client' };
  if (role === 'manager') return { role: 'Manager', side: 'sbc' };
  if (role === 'intern') return { role: 'Lead', side: 'sbc' };
  return { role: 'SBC', side: 'sbc' };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const short = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';

type Raw = typeof auditEvents.$inferSelect;

function project(
  r: Raw,
  names: Map<string, string>,
  company: string,
): ClientAuditEvent {
  const m = (r.metadata ?? {}) as Record<string, unknown>;
  const { day, time } = istParts(r.createdAt);
  const actorName = names.get(r.actorUserId) || r.actorName?.replace(EMAIL_RE, '').trim() || '';
  const rl = roleLabel(r.actorRole);
  const whoName = actorName || (rl.side === 'client' ? company : 'SBC');
  const step = (id: string) => (id ? checklistItemLabel(id) : '');
  const stepHref = (id: string) => `/app/client/incorporation/step/${encodeURIComponent(id)}`;
  let node: AuditNode = 'ok';
  let cat: AuditCategory = 'Milestones';
  let action = formatAuditActionLabel(r.action);
  let subject = scrub(r.summary);
  let facts: Array<{ k: string; v: string }> = [];
  let cta: ClientAuditEvent['cta'];
  const a = r.action;

  if (a === 'checklist.deliver') {
    action = 'Step delivered';
    subject = step(str(m.itemId)) || subject;
    facts = [{ k: 'Step', v: subject }];
    if (str(m.itemId)) cta = { label: 'Open step', href: stepHref(str(m.itemId)) };
  } else if (a === 'engagement.checklist.submit') {
    node = 'up';
    action = 'Step submitted';
    subject = scrub(r.summary.replace(/^Submitted\s+/i, '')) || subject;
    facts = [{ k: 'Step', v: subject }, { k: 'Status', v: 'With SBC · to review' }];
    cta = { label: 'Open Incorporation', href: '/app/client/incorporation' };
  } else if (a.startsWith('checklist.')) {
    const id = str(m.itemId) || str(m.stepId);
    if (id) subject = step(id);
    const verb = a.slice('checklist.'.length);
    const back = /reject|return|sent_back|changes/.test(verb) || /reject|changes|sent_back/.test(str(m.decision) + str(m.status));
    if (back) node = 'back';
    else if (verb === 'save' || verb === 'submit') node = 'up';
    action = back ? 'Changes asked' : (CHECKLIST_LABEL[verb] ?? 'Step updated');
    if (id) cta = { label: 'Open step', href: stepHref(id) };
  } else if (a === 'client.need_uploaded' || a === 'client.need_upload_undone') {
    cat = 'Documents';
    node = a === 'client.need_uploaded' ? 'up' : 'back';
    action = a === 'client.need_uploaded' ? 'Document uploaded' : 'Upload undone';
    subject = scrub(r.summary.replace(/\s+uploaded$/i, '')) || subject;
    cta = { label: 'Open Documents', href: '/app/client/documents' };
  } else if (a.startsWith('client.timeline_change')) {
    node = 'time';
    action = TIMELINE_LABEL[a] ?? 'Timeline change';
    cta = { label: 'Open Incorporation', href: '/app/client/incorporation' };
  } else if (a === 'board_resolution.finalize') {
    cat = 'Documents';
    action = 'Board resolution released';
    subject = 'Final board resolution';
    facts = [{ k: 'Status', v: 'Final' }];
    cta = { label: 'Open board resolution', href: '/app/client/board-resolution' };
  } else if (a === 'incorporation_docs.share') {
    cat = 'Documents';
    action = 'Document shared';
    subject = str(m.doc) || subject;
    facts = [{ k: 'Document', v: str(m.doc) }, { k: 'Director', v: str(m.director) }].filter((f) => f.v);
    cta = { label: 'Preview file', href: '/app/client/documents' };
  } else if (a === 'incorporation_docs.share_all') {
    cat = 'Documents';
    action = 'Documents shared';
    const n = Array.isArray(m.rowKeys) ? m.rowKeys.length : 0;
    subject = n ? `${n} incorporation drafts` : 'Incorporation drafts';
    if (n) facts = [{ k: 'Items', v: String(n) }];
    cta = { label: 'Open Documents', href: '/app/client/documents' };
  } else if (a.startsWith('doc_pack.')) {
    cat = 'Documents';
    action = a === 'doc_pack.download_zip' ? 'Documents downloaded' : 'Document downloaded';
    subject = scrub(r.summary.replace(/^Downloaded\s+/i, '').replace(/\s+from the document pack$/i, ''));
    if (str(m.filename)) facts = [{ k: 'File', v: str(m.filename) }];
    cta = { label: 'Open Documents', href: '/app/client/documents' };
  } else if (a.startsWith('document_request.')) {
    cat = 'Documents';
    // Match on the verb only: the prefix itself contains "request".
    const verb = a.slice('document_request.'.length);
    if (/sent_back|reject/.test(verb)) {
      node = 'back';
      action = 'Document sent back';
      cta = { label: 'Upload again', href: '/app/client/documents' };
    } else if (/create|request/.test(verb)) {
      node = 'req';
      action = 'Documents requested';
      cta = { label: 'Open request', href: '/app/client/documents' };
    } else if (/upload/.test(verb)) {
      node = 'up';
      action = 'Document uploaded';
      cta = { label: 'Preview file', href: '/app/client/documents' };
    }
    if (str(m.title)) subject = str(m.title);
    if (str(m.reason)) facts.push({ k: 'Reason', v: scrub(str(m.reason)) });
    if (str(m.dueDate)) facts.push({ k: 'Due', v: short(str(m.dueDate)) });
    if (str(m.fileName)) facts.push({ k: 'File', v: str(m.fileName) });
  } else if (a === 'client.change_request') {
    node = 'time';
    action = 'Change request sent';
    subject = step(str(m.stepId)) || subject;
    facts = [{ k: 'Step', v: subject }];
    if (str(m.stepId)) cta = { label: 'Open step', href: stepHref(str(m.stepId)) };
  } else if (a.startsWith('client.')) {
    cat = 'Team';
    node = 'team';
    cta = { label: 'Open Team', href: '/app/client/team' };
    const invited = names.get(str(m.invitedUserId)) || '';
    if (a === 'client.invite') {
      action = 'Colleague invited';
      subject = invited || 'A colleague';
      facts = [{ k: 'Invited', v: subject }, { k: 'Access', v: 'Member' }];
    } else if (a === 'client.invite_resend') {
      action = 'Invite sent again';
      subject = invited || 'A colleague';
    } else if (a === 'client.invite_revoke') {
      action = 'Invite cancelled';
      subject = invited || 'A colleague';
    } else if (a === 'client.invite_restore') {
      action = 'Invite restored';
      subject = invited || 'A colleague';
    } else if (a === 'client.substitute') {
      const before = names.get(str(m.replacedUserId)) || 'A colleague';
      const after = names.get(str(m.newUserId)) || 'A colleague';
      action = m.becamePrimary ? 'Primary contact handed over' : 'Colleague replaced';
      subject = after;
      facts = [{ k: 'Before', v: before }, { k: 'After', v: after }, { k: 'Access', v: m.becamePrimary ? 'Primary' : 'Member' }];
    } else if (a === 'client.ask_handoff') {
      node = 'mail';
      action = 'Question sent to the lead';
      subject = 'From Ask VCFO';
      cta = undefined;
    }
  } else if (a === 'project.client_changed') {
    cat = 'Team';
    node = 'team';
    action = 'Primary contact changed';
    subject = company;
    cta = { label: 'Open Team', href: '/app/client/team' };
  } else if (a.startsWith('welcome_email.') || a === 'email_templates.fire') {
    cat = 'Email';
    node = 'mail';
    action = 'Email sent';
    subject = a.startsWith('welcome_email.') ? 'Welcome to VCFO Suite' : scrub(r.summary.replace(/^Checklist email sent:?\s*/i, '')) || 'Update';
    facts = [{ k: 'To', v: company.split(/\s+/)[0] ?? company }, { k: 'Status', v: m.skipped ? 'Not sent' : 'Sent' }];
    cta = { label: 'Email settings', href: '/app/client/settings#notifications' };
  } else if (a.startsWith('credentials.')) {
    cat = 'Credentials';
    action = CREDENTIALS_LABEL[a.slice('credentials.'.length)] ?? 'Credentials updated';
    subject = 'Credentials access log';
    if (str(m.label)) facts = [{ k: 'Credential', v: str(m.label) }];
    cta = { label: 'Open Credentials', href: '/app/client/credentials' };
  }

  return {
    id: r.id,
    at: r.createdAt.toISOString(),
    day,
    time,
    node,
    cat,
    action,
    subject: subject || action,
    who: { name: whoName, initials: initialsOf(whoName), role: rl.role, side: rl.side },
    facts: facts.filter((f) => f.v),
    result: auditResultWord(r.result, node),
    cta,
  };
}

async function namesFor(rows: Raw[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.actorUserId);
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    for (const k of ['invitedUserId', 'replacedUserId', 'newUserId']) {
      const v = m[k];
      if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) ids.add(v);
    }
  }
  if (!ids.size) return new Map();
  const ps = await db.select({ id: profiles.id, name: profiles.name }).from(profiles).where(inArray(profiles.id, [...ids]));
  return new Map(ps.filter((p) => p.name?.trim() && !p.name.includes('@')).map((p) => [p.id, p.name!.trim()]));
}

/** `created_at` to the millisecond, the precision a cursor carries (G-28). */
const createdMs = sql`date_trunc('milliseconds', ${auditEvents.createdAt})`;

/**
 * The page cursor: `<iso>|<id>` of the last row shown. A bare ISO time (older links) still
 * works, without the id tie-break.
 */
export function parseClientAuditCursor(raw: string | null | undefined): { before?: Date; beforeId?: string } {
  if (!raw) return {};
  const [iso, id] = raw.split('|');
  const before = iso ? new Date(iso) : undefined;
  if (!before || Number.isNaN(before.getTime())) return {};
  return { before, beforeId: id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined };
}

export async function listClientAuditEvents(
  ctx: AuthContext,
  opts: { before?: Date; beforeId?: string; limit?: number; withSummary?: boolean } = {},
): Promise<ClientAuditPage> {
  const { dbId, company } = await myEngagementDbId(ctx);
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 2000);
  const conds = [eq(auditEvents.engagementId, dbId), allowed()];
  if (opts.before && !Number.isNaN(opts.before.getTime())) {
    if (opts.beforeId) {
      conds.push(lt(auditEvents.createdAt, new Date(opts.before.getTime() + 1)));
      conds.push(
        or(
          sql`${createdMs} < ${opts.before}`,
          and(sql`${createdMs} = ${opts.before}`, lt(auditEvents.id, opts.beforeId)),
        )!,
      );
    } else {
      conds.push(lt(auditEvents.createdAt, opts.before));
    }
  }
  const rows = await db
    .select()
    .from(auditEvents)
    .where(and(...conds))
    .orderBy(desc(createdMs), desc(auditEvents.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const names = await namesFor(page);
  const events = page.map((r) => project(r, names, company));
  const last = page[page.length - 1];
  const out: ClientAuditPage = {
    events,
    nextBefore: rows.length > limit && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
  if (opts.withSummary) out.summary = await summary(dbId);
  return out;
}

/** Event counts per IST day for the last 14 days (today last). */
async function summary(dbId: string): Promise<ClientAuditSummary> {
  const today = istParts(new Date()).day;
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const since = new Date(new Date(`${days[0]}T00:00:00Z`).getTime() - 330 * 60_000);
  const rows = await db
    .select({ at: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(eq(auditEvents.engagementId, dbId), allowed(), gte(auditEvents.createdAt, since)))
    .limit(5000);
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const d = istParts(r.at).day;
    if (counts.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const list = days.map((day) => ({ day, count: counts.get(day) ?? 0 }));
  return { days: list, total: list.reduce((n, d) => n + d.count, 0) };
}

/** All events of one IST day (the day drill-down). */
export async function listClientAuditDay(ctx: AuthContext, day: string): Promise<ClientAuditEvent[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const { dbId, company } = await myEngagementDbId(ctx);
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - 330 * 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  const rows = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.engagementId, dbId), allowed(), gte(auditEvents.createdAt, start), lt(auditEvents.createdAt, end)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(500);
  const names = await namesFor(rows);
  return rows.map((r) => project(r, names, company));
}
