import { describe, expect, it } from 'vitest';
import type { AuditEventRow } from '@/lib/audit/audit-log';
import { auditAreaOf, auditChange, auditResultWord, whoMatches } from './audit-filters';

const ev = (p: Partial<AuditEventRow>) => ({ id: 'e', action: 'x', actor_role: 'manager', created_at: '2026-10-14T09:00:00Z', metadata: {}, ...p }) as AuditEventRow;

describe('audit filters', () => {
  it('splits credentials and sign-in out of the shared areas', () => {
    expect(auditAreaOf('credentials.reveal')).toBe('credentials');
    expect(auditAreaOf('auth.sign_in')).toBe('signin');
    expect(auditAreaOf('account.two_step_enable')).toBe('signin');
    expect(auditAreaOf('document_request.close')).toBe('documents');
  });

  it('names the result: Done, Sent back, Failed or Denied', () => {
    expect(auditResultWord(ev({ action: 'step.done' }))).toBe('Done');
    expect(auditResultWord(ev({ action: 'document.review', metadata: { status: 'changes' } }))).toBe('Sent back');
    expect(auditResultWord(ev({ result: 'failed' } as Partial<AuditEventRow>))).toBe('Failed');
    expect(auditResultWord(ev({ result: 'denied' } as Partial<AuditEventRow>))).toBe('Denied');
  });

  it('reads a one-line change from before/after, from/to or old/new', () => {
    expect(auditChange({ before: 'Open', after: 'Done' })).toEqual({ before: 'Open', after: 'Done' });
    expect(auditChange({ from: null, to: 3 })).toEqual({ before: '—', after: '3' });
    expect(auditChange({ before: { a: 1 }, after: 'x' })).toBeNull();
    expect(auditChange({ note: 'x' })).toBeNull();
  });

  it('matches SBC as every staff role and a role on its own', () => {
    expect(whoMatches('super_admin', 'sbc')).toBe(true);
    expect(whoMatches('client', 'sbc')).toBe(false);
    expect(whoMatches('client', 'client')).toBe(true);
    expect(whoMatches('admin', 'all')).toBe(true);
  });
});
