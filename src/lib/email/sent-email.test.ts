import { describe, expect, it } from 'vitest';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { latestSentEmailByItem, sentEmailFromAudit, sentEmailReached, senderForClient } from './sent-email';

function row(over: Partial<AuditEventRow> = {}): AuditEventRow {
  return {
    id: 'a1',
    created_at: '2026-11-12T09:30:00.000Z',
    actor_user_id: 'u1',
    actor_role: 'intern',
    actor_email: 'asha.rao@sbc.example',
    actor_name: 'Asha Rao',
    engagement_id: 'e1',
    action: 'email.sent',
    summary: '',
    metadata: { to: ['client@acme.in'], cc: ['cfo@acme.in'], subject: 'Proposed directors is open', itemId: 'pre-15' },
    result: 'ok',
    ...over,
  } as AuditEventRow;
}

/** GL-07: who sent the email, when, to whom and the subject, as each viewer may read it. */
describe('sent email lines', () => {
  it('gives staff the full sender name', () => {
    expect(sentEmailFromAudit(row())).toEqual({
      at: '2026-11-12T09:30:00.000Z',
      by: 'Asha Rao',
      to: ['client@acme.in'],
      subject: 'Proposed directors is open',
      itemId: 'pre-15',
    });
  });

  it('gives a client the first name of a Lead or Manager and only "Admin" for an Admin', () => {
    expect(sentEmailFromAudit(row(), { forClient: true }).by).toBe('Asha');
    expect(senderForClient({ actor_role: 'manager', actor_name: 'Vikram Shah' })).toBe('Vikram');
    expect(senderForClient({ actor_role: 'admin', actor_name: 'Priya Iyer' })).toBe('Admin');
    expect(senderForClient({ actor_role: 'super_admin', actor_name: 'Owner' })).toBe('Admin');
    expect(senderForClient({ actor_role: 'intern', actor_name: null })).toBe('SBC');
  });

  it('knows whether the email reached an address in To or Cc', () => {
    expect(sentEmailReached(row(), 'CLIENT@acme.in')).toBe(true);
    expect(sentEmailReached(row(), 'cfo@acme.in')).toBe(true);
    expect(sentEmailReached(row(), 'other@acme.in')).toBe(false);
    expect(sentEmailReached(row(), '')).toBe(false);
  });

  it('keeps the newest email of each step for the cards', () => {
    const newest = sentEmailFromAudit(row({ created_at: '2026-11-12T10:00:00.000Z' }));
    const older = sentEmailFromAudit(row());
    const other = sentEmailFromAudit(row({ metadata: { to: ['a@b.in'], subject: 'Request list', itemId: null } }));
    const latest = latestSentEmailByItem([newest, older, other]);
    expect(latest.get('pre-15')).toBe(newest);
    expect(latest.size).toBe(1);
  });
});
