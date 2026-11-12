import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));

const { portalNav, currentLeaf } = await import('./Sidebar');

/**
 * R-51 (D-29): the client sidebar keeps its order — Incorporation, Compliances, Registrations
 * while incorporating — with the shared icons: Landmark, CalendarCheck and BadgeCheck.
 */
describe('client portal sidebar (R-51)', () => {
  const nav = (after: boolean) => portalNav({ after, unread: 0, inc: '6/25', docs: 0 });

  it('while incorporating: Home, the practice block, then the work rows, then Updates', () => {
    const items = nav(false);
    /* The Labour registers row sits after the practice block and before Updates, which is where
       the staff sidebar puts it. R-51 governs the three practice labels and their order, not
       what follows them. */
    expect(items.slice(0, 6).map((n) => n.t)).toEqual([
      'Home',
      'Incorporation',
      'Compliances',
      'Registrations',
      'Labour registers',
      'Updates',
    ]);
    expect(items.slice(1, 4).map((n) => n.i)).toEqual(['landmark', 'calendar-check', 'badge-check']);
    expect(items[1].badge).toBe('6/25');
    expect(items[2].kids?.map((k) => k.t)).toEqual(['Obligations', 'Calendar', 'Filings', 'Budgets']);
    expect(items[2].kids?.map((k) => k.k)).toEqual(['obligations', 'compliances', 'filings', 'budgets']);
    expect(items[3].k).toBe('registrations');

    /* Labour registers is its own row, not a label inside Compliances. The Payroll row was
       removed with the Payroll module (owner, 12 Nov 2026). */
    expect(items[4].k).toBe('labour-registers');
    expect(items[4].i).toBe('scroll-text');
    expect(items.map((n) => n.k as string | undefined)).not.toContain('payroll');
  });

  it('once incorporated: the order it had before R-51 is kept', () => {
    expect(nav(true).slice(1, 4).map((n) => n.t)).toEqual(['Compliances', 'Registrations', 'Incorporation']);
  });
});

describe('Incorporation opens into its phases (owner, 10 Nov)', () => {
  const inc = portalNav({ after: false, unread: 0, inc: '6/25', docs: 0 })[1]!;

  it('lists the overview and phases 1 to 3; Registrations has its own item', () => {
    expect(inc.kids?.map((k) => k.t)).toEqual([
      'Overview',
      '1 · Name application',
      '2 · Incorporation',
      '3 · Post-incorporation',
    ]);
  });

  it('marks the phase being read, and the overview for the other incorporation pages', () => {
    const kids = inc.kids!;
    expect(currentLeaf(kids, 'incorporation', '/app/client/incorporation/phase/2')?.t).toBe('2 · Incorporation');
    expect(currentLeaf(kids, 'incorporation', '/app/client/incorporation/step/pre-1')?.t).toBe('Overview');
    expect(currentLeaf(kids, 'incorporation', '/app/client/incorporation')?.t).toBe('Overview');
    expect(currentLeaf(kids, 'home', '/app/client')).toBeUndefined();
  });
});

describe('client portal sidebar: going back to a main page', () => {
  it('counts only the page itself as "already there", not a page under it', async () => {
    const { isSameNavPage } = await import('./Sidebar');
    expect(isSameNavPage('/app/client/registrations', '/app/client/registrations')).toBe(true);
    expect(isSameNavPage('/app/client/registrations/', '/app/client/registrations')).toBe(true);
    expect(isSameNavPage('/app/client/registrations/gst', '/app/client/registrations')).toBe(false);
  });
});
