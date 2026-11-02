/**
 * Client-safe audit projection (client portal v7 — Audit page). Pure types
 * shared by the repository (`client-audit.ts`), the API routes and the page.
 *
 * Owner decision: SBC staff appear by NAME and ROLE only — no emails, no ids,
 * no raw metadata. Every fact is built server-side in plain words.
 */

export type AuditNode = 'req' | 'back' | 'up' | 'ok' | 'time' | 'mail' | 'team';
export type AuditCategory = 'Documents' | 'Milestones' | 'Team' | 'Email' | 'Credentials';
export type AuditRoleLabel = 'Manager' | 'Lead' | 'SBC' | 'System' | 'Client';

export const AUDIT_CATEGORIES: AuditCategory[] = ['Documents', 'Milestones', 'Team', 'Email', 'Credentials'];

export interface ClientAuditEvent {
  id: string;
  /** ISO timestamp (keyset cursor). */
  at: string;
  /** IST calendar day yyyy-mm-dd. */
  day: string;
  /** IST HH:MM. */
  time: string;
  node: AuditNode;
  cat: AuditCategory;
  action: string;
  subject: string;
  who: { name: string; initials: string; role: AuditRoleLabel; side: 'sbc' | 'client' };
  facts: Array<{ k: string; v: string }>;
  cta?: { label: string; href: string };
}

export interface ClientAuditSummary {
  /** 14 IST days, oldest first; the last is today. `cats` splits the day's count by category. */
  days: Array<{ day: string; count: number; cats?: Partial<Record<AuditCategory, number>> }>;
  total: number;
}

export interface ClientAuditPage {
  events: ClientAuditEvent[];
  /** Pass as `before` for the next page; null = no older events. */
  nextBefore: string | null;
  summary?: ClientAuditSummary;
}

/** IST yyyy-mm-dd and HH:MM for an instant. */
export function istParts(d: Date): { day: string; time: string } {
  const s = new Date(d.getTime() + 330 * 60_000).toISOString();
  return { day: s.slice(0, 10), time: s.slice(11, 16) };
}

/**
 * The category a client-visible audit action falls in — the same split the
 * repository's projection makes: documents, team changes, emails, credential
 * access; everything else (steps, timeline) is a milestone.
 */
export function auditCategoryOf(action: string): AuditCategory {
  const a = action;
  if (a === 'client.need_uploaded' || a === 'client.need_upload_undone') return 'Documents';
  if (a === 'board_resolution.finalize' || a.startsWith('incorporation_docs.') || a.startsWith('doc_pack.') || a.startsWith('document_request.')) return 'Documents';
  if (a.startsWith('client.timeline_change') || a === 'client.change_request') return 'Milestones';
  if (a.startsWith('client.') || a === 'project.client_changed') return 'Team';
  if (a.startsWith('welcome_email.') || a === 'email_templates.fire') return 'Email';
  if (a.startsWith('credentials.')) return 'Credentials';
  return 'Milestones';
}
