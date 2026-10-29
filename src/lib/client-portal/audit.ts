/**
 * Client-safe audit projection (client portal v7 — Audit page). Pure types
 * shared by the repository (`client-audit.ts`), the API routes and the page.
 *
 * Owner decision: SBC staff appear by NAME and ROLE only — no emails, no ids,
 * no raw metadata. Every fact is built server-side in plain words.
 */

export type AuditNode = 'req' | 'back' | 'up' | 'ok' | 'time' | 'mail' | 'team';
export type AuditCategory = 'Documents' | 'Milestones' | 'Team' | 'Email' | 'Credentials' | 'Sign-in';
export type AuditRoleLabel = 'Manager' | 'Lead' | 'SBC' | 'System' | 'Client';
/**
 * What happened to the action, from `audit_events.result` (G-28): `ok` reads
 * "Done" (or "Sent back" when the action asked for a fix), `failed` "Failed"
 * and `denied` "Denied".
 */
export type AuditResult = 'Done' | 'Sent back' | 'Failed' | 'Denied';

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
  result: AuditResult;
  cta?: { label: string; href: string };
}

export interface ClientAuditSummary {
  /** 14 IST days, oldest first; the last is today. */
  days: Array<{ day: string; count: number }>;
  total: number;
}

export interface ClientAuditPage {
  events: ClientAuditEvent[];
  /** Pass as `before` for the next page (`<iso>|<id>`); null = no older events. */
  nextBefore: string | null;
  summary?: ClientAuditSummary;
}

/** IST yyyy-mm-dd and HH:MM for an instant. */
export function istParts(d: Date): { day: string; time: string } {
  const s = new Date(d.getTime() + 330 * 60_000).toISOString();
  return { day: s.slice(0, 10), time: s.slice(11, 16) };
}

/** The Result word for a stored `audit_events.result` and the event's node. */
export function auditResultWord(result: string | null | undefined, node: AuditNode): AuditResult {
  if (result === 'failed') return 'Failed';
  if (result === 'denied') return 'Denied';
  return node === 'back' ? 'Sent back' : 'Done';
}
