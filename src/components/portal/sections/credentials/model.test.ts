import { describe, expect, it } from 'vitest';
import type { WireGrant, WireRow, WireSheet } from '@/lib/client-portal/credentials';
import { attention, canEdit, modeOf, monoOf, portalKeys, previewed, statusOf, until } from './model';

const row = (key: string, label: string, cells: Record<string, { v: string | null; has?: boolean }> = {}): WireRow => ({
  key,
  cells: { label: { v: label }, id: { v: '' }, password: { v: '' }, mail: { v: '' }, mobile: { v: '' }, status: { v: 'Pending' }, ...cells },
});

const login: WireSheet = {
  id: 'login',
  cols: [],
  rows: [
    row('cin', 'Company CIN', { id: { v: null, has: true } }),
    row('gst', 'Goods and Service Tax (GST)'),
    row('fla', 'FLA', { id: { v: 'fla-user' }, status: { v: 'Expired' } }),
    row('pf', 'Provident Fund (PF)', { status: { v: 'Active' }, password: { v: null, has: true } }),
    { key: 'spacer-0', spacer: true, cells: {} },
    row('zz', 'Custom portal', { mail: { v: 'ops@example.com' } }),
  ],
};

describe('credentials model', () => {
  it('builds key cards only from login rows that hold something, expired first', () => {
    const keys = portalKeys(login);
    expect(keys.map((k) => k.key)).toEqual(['fla', 'cin', 'zz', 'pf']);
    expect(keys[0]).toMatchObject({ status: 'expired', law: 'FEMA', mono: 'FLA', portal: { host: 'flair.rbi.org.in' } });
    expect(keys[1]).toMatchObject({ status: 'pending', law: 'MCA', mono: 'CIN' });
    expect(keys[3]).toMatchObject({ status: 'active', law: 'PAY' });
    // a custom row gets initials and no portal link
    expect(keys[2]).toMatchObject({ mono: 'CP', portal: undefined });
  });

  it('lists expired and pending logins on the attention line', () => {
    expect(attention(portalKeys(login)).map((a) => [a.tone, a.text])).toEqual([
      ['r', 'FLA expired'],
      ['a', 'Company CIN pending'],
      ['a', 'Custom portal pending'],
    ]);
  });

  it('reads statuses and tile text', () => {
    expect(statusOf('Active')).toBe('active');
    expect(statusOf('Not applicable')).toBe('na');
    expect(statusOf('')).toBe('pending');
    expect(monoOf('rbi-entity', 'RBI Entity Logins')).toBe('RBI');
    expect(monoOf('x', 'Reporting Portal (RBI)')).toBe('RP');
  });

  it('applies grants by scope and mode', () => {
    const t = Date.now() + 60_000;
    const grants: WireGrant[] = [
      { id: '1', mode: 'preview', scope: 'tab:login', expiresAt: new Date(t).toISOString() },
      { id: '2', mode: 'edit', scope: 'row:reg|gst', expiresAt: new Date(t).toISOString() },
      { id: '3', mode: 'reveal', scope: 'cell:ids|pan|value', expiresAt: new Date(t).toISOString() },
      { id: '4', mode: 'edit', scope: 'tab:other', expiresAt: new Date(t - 120_000).toISOString() },
    ];
    expect(until(grants, 'tab:login')).toBe(t);
    expect(modeOf(grants, 'tab:login')).toBe('Preview');
    expect(modeOf(grants, 'row:reg|gst')).toBe('Edit');
    expect(previewed(grants, false, 'login|cin|id')).toBe(true);
    expect(previewed(grants, false, 'reg|gst|password')).toBe(true);
    expect(previewed(grants, false, 'reg|pf|password')).toBe(false);
    expect(previewed(grants, false, 'ids|pan|value')).toBe(true);
    expect(previewed(grants, true, 'reg|pf|password')).toBe(true);
    expect(canEdit(grants, false, 'reg', 'gst')).toBe(true);
    expect(canEdit(grants, false, 'reg', 'pf')).toBe(false);
    expect(canEdit(grants, false, 'login', 'cin')).toBe(false);
    expect(canEdit(grants, false, 'other', 'r1')).toBe(false);
  });
});
