import type { AuditEventRow } from '@/lib/audit/audit-log';

/** One email a person sent from a card (GL-07), read from its `email.sent` audit record. */
export interface SentEmailRow {
  at: string;
  by: string;
  to: string[];
  subject: string;
  /** The step the email was sent from (`pre-15`), or null when it came from another card. */
  itemId?: string | null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * The sender as a client may read it (BR-03): the first name of a Lead or Manager, and only the
 * word "Admin" for an Admin. Never an email address.
 */
export function senderForClient(row: Pick<AuditEventRow, 'actor_role' | 'actor_name'>): string {
  if (row.actor_role === 'admin' || row.actor_role === 'super_admin') return 'Admin';
  const first = row.actor_name?.trim().split(/\s+/)[0];
  return first || 'SBC';
}

/** An `email.sent` audit row as the line a step shows; `forClient` hides the staff details. */
export function sentEmailFromAudit(row: AuditEventRow, opts: { forClient?: boolean } = {}): SentEmailRow {
  const meta = row.metadata ?? {};
  return {
    at: row.created_at,
    by: opts.forClient ? senderForClient(row) : row.actor_name || row.actor_email || 'Someone',
    to: stringList(meta.to),
    subject: typeof meta.subject === 'string' ? meta.subject : '',
    itemId: typeof meta.itemId === 'string' ? meta.itemId : null,
  };
}

/** True when `email` is one of the record's To or Cc addresses (case does not matter). */
export function sentEmailReached(row: AuditEventRow, email: string): boolean {
  const me = email.trim().toLowerCase();
  if (!me) return false;
  return [...stringList(row.metadata?.to), ...stringList(row.metadata?.cc)].some((a) => a.trim().toLowerCase() === me);
}

/** The newest email per step, for the compact line on each step card. Rows come newest first. */
export function latestSentEmailByItem(rows: SentEmailRow[]): Map<string, SentEmailRow> {
  const latest = new Map<string, SentEmailRow>();
  for (const row of rows) {
    if (row.itemId && !latest.has(row.itemId)) latest.set(row.itemId, row);
  }
  return latest;
}
