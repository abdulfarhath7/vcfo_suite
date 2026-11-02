import { describe, expect, it } from 'vitest';
import { activeLeaf, groupOf, navLeaves, SEAT_NAV } from './nav';

const mgr = SEAT_NAV.mgr!;

describe('manager console navigation', () => {
  it('lists every manager page once', () => {
    const keys = navLeaves(mgr).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['today', 'approvals', 'requests', 'work', 'leads', 'load', 'clients', 'calendar', 'filings', 'email', 'whatsapp', 'vault', 'knowledge', 'anns', 'notes', 'regulatory', 'analytics', 'audit', 'settings']);
  });

  it('finds the current page from the path, including pages below it and old addresses', () => {
    expect(activeLeaf(mgr, '/app/manager/dashboard')?.key).toBe('today');
    expect(activeLeaf(mgr, '/app/manager/projects/northwind/step/pre-7')?.key).toBe('clients');
    expect(activeLeaf(mgr, '/app/manager/compliances/filings')?.key).toBe('filings');
    expect(activeLeaf(mgr, '/app/manager/team')?.key).toBe('leads');
    expect(activeLeaf(mgr, '/app/manager/regulatory-updates/')?.key).toBe('regulatory');
    expect(activeLeaf(mgr, '/app/manager/nowhere')).toBeUndefined();
  });

  it('knows the section that holds a page', () => {
    expect(groupOf(mgr, 'filings')?.label).toBe('Book');
    expect(groupOf(mgr, 'regulatory')?.label).toBe('Workspace');
  });
});

describe('project lead console navigation', () => {
  const lead = SEAT_NAV.lead!;

  it('lists every lead page once, all under /app/intern', () => {
    const items = navLeaves(lead);
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(['today', 'tasks', 'reviews', 'clients', 'registrations', 'calendar', 'filings', 'team', 'email', 'whatsapp', 'vault', 'knowledge', 'anns', 'notes', 'analytics', 'audit', 'settings']);
    expect(items.every((i) => i.href.startsWith('/app/intern/'))).toBe(true);
  });

  it('keeps the live addresses working', () => {
    expect(activeLeaf(lead, '/app/intern/engagements/abc/step/pre-7')?.key).toBe('clients');
    expect(activeLeaf(lead, '/app/intern/projects/northwind')?.key).toBe('clients');
    expect(activeLeaf(lead, '/app/intern/requests')?.key).toBe('tasks');
    expect(activeLeaf(lead, '/app/intern/compliance')?.key).toBe('calendar');
    expect(activeLeaf(lead, '/app/manager/dashboard')).toBeUndefined();
  });
});
