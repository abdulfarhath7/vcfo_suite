import { describe, expect, it } from 'vitest';
import { clientChangesNameExpiry } from '@/lib/checklist/name-approval-expiry';

// Approval on 1 Nov: the calculated expiry is 21 Nov (20 days).
const stored = { nameApprovalDate: '2026-11-01', nameApprovalExpiryDate: '2026-11-21' };

describe('clientChangesNameExpiry (SA-02)', () => {
  it('refuses a client who types another expiry date or clears it', () => {
    expect(clientChangesNameExpiry('pre-5', { nameApprovalExpiryDate: '2026-12-31' }, stored)).toBe(true);
    expect(clientChangesNameExpiry('pre-5', { nameApprovalExpiryDate: '' }, stored)).toBe(true);
  });

  it('lets the calculated date follow a new approval date or fill an empty expiry', () => {
    expect(clientChangesNameExpiry('pre-5', { nameApprovalDate: '2026-11-05', nameApprovalExpiryDate: '2026-11-25' }, stored)).toBe(false);
    expect(clientChangesNameExpiry('pre-5', { nameApprovalExpiryDate: '2026-11-21' }, { nameApprovalDate: '2026-11-01' })).toBe(false);
  });

  it('never lets a client save replace a date staff set by hand', () => {
    const edited = { nameApprovalDate: '2026-11-01', nameApprovalExpiryDate: '2026-11-30' };
    expect(clientChangesNameExpiry('pre-5', { nameApprovalExpiryDate: '2026-11-21' }, edited)).toBe(true);
    expect(clientChangesNameExpiry('pre-5', { nameApprovalDate: '2026-11-05', nameApprovalExpiryDate: '2026-11-25' }, edited)).toBe(true);
  });

  it('ignores unchanged values, other fields and other steps', () => {
    expect(clientChangesNameExpiry('pre-5', { nameApprovalExpiryDate: '2026-11-21' }, stored)).toBe(false);
    expect(clientChangesNameExpiry('pre-5', { approvedCompanyName: 'Acme' }, stored)).toBe(false);
    expect(clientChangesNameExpiry('pre-4', { nameApprovalExpiryDate: '2026-12-31' }, stored)).toBe(false);
  });
});
