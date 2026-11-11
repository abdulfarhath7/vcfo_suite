import { describe, expect, it } from 'vitest';
import {
  isSidebarGroupActive,
  sidebarNavTriggerClass,
  type SidebarNavLeaf,
} from '@/components/shell/SidebarNavGroup';
import {
  complianceCalendarPath,
  complianceLeaves,
  compliancesBasePath,
} from '@/components/shell/compliance-nav';

const leaves: SidebarNavLeaf[] = [
  { to: '/app/lead/vault', label: 'Vault', icon: () => null },
  { to: '/app/lead/knowledge-bank', label: 'Knowledge Bank', icon: () => null },
];

describe('sidebar nav groups', () => {
  it('treats vault and knowledge-bank as the Docs section', () => {
    expect(isSidebarGroupActive('/app/lead/vault', leaves)).toBe(true);
    expect(isSidebarGroupActive('/app/lead/knowledge-bank', leaves)).toBe(true);
    expect(isSidebarGroupActive('/app/lead/today', leaves)).toBe(false);
  });

  it('lights the Compliances group on either child, for every shell base', () => {
    for (const base of ['/app/client', '/app/lead', '/app/manager', '/app/admin']) {
      const leaves = complianceLeaves(base);
      expect(leaves.map((leaf) => leaf.label)).toEqual(['Obligations', 'Calendar', 'Filings']);
      expect(leaves.map((leaf) => leaf.to)).toEqual([
        `${base}/compliances/obligations`,
        `${base}/compliances/calendar`,
        `${base}/compliances/filings`,
      ]);
      expect(isSidebarGroupActive(`${base}/compliances/obligations`, leaves)).toBe(true);
      expect(isSidebarGroupActive(`${base}/compliances/calendar`, leaves)).toBe(true);
      expect(isSidebarGroupActive(`${base}/compliances/filings`, leaves)).toBe(true);
      expect(isSidebarGroupActive(`${base}/compliance`, leaves)).toBe(false);
      expect(isSidebarGroupActive(`${base}/dashboard`, leaves)).toBe(false);
    }
  });

  it('sends the super admin into the firm scope and everyone else to their own shell', () => {
    expect(compliancesBasePath('super_admin', '/app/super')).toBe('/app/admin');
    expect(compliancesBasePath('admin', '/app/admin')).toBe('/app/admin');
    expect(compliancesBasePath('manager', '/app/manager')).toBe('/app/manager');
    expect(compliancesBasePath('intern', '/app/manager')).toBe('/app/lead');
    expect(compliancesBasePath('client', '/app/manager')).toBe('/app/client');
    expect(complianceCalendarPath('super_admin', '/app/super')).toBe('/app/admin/compliances/calendar');
    expect(complianceCalendarPath('manager', '/app/manager')).toBe('/app/manager/compliances/calendar');
  });

  it('uses the shared full-width disclosure trigger', () => {
    const cls = sidebarNavTriggerClass({
      ink: 'light',
      active: false,
      expanded: true,
      fillHover: false,
    });
    expect(cls).toContain('sidebar-nav-disclosure-trigger');
    expect(cls).toContain('w-full');
  });
});

describe('Incorporation dropdown (NV-01, NV-02)', () => {
  it('lists Overview, SPICe+ Part A, Part B, Board resolutions and Documents for every staff role', async () => {
    const { incorporationGroup } = await import('./sidebar-items');
    for (const base of ['/app/lead', '/app/manager', '/app/admin', '/app/super/practice']) {
      expect(incorporationGroup(base).items.map((i) => i.label)).toEqual([
        'Overview',
        'SPICe+ Part A',
        'SPICe+ Part B',
        'Board resolutions',
        'Documents',
      ]);
      expect(incorporationGroup(base).items[0]!.to).toBe(`${base}/incorporation`);
    }
  });

  it('highlights exactly one sub-item for the open view', async () => {
    const { isSidebarLeafActive } = await import('./SidebarNavGroup');
    const main = '/app/manager/incorporation';
    expect(isSidebarLeafActive(main, '', main)).toBe(true);
    expect(isSidebarLeafActive(main, '', `${main}?view=part-a`)).toBe(false);
    expect(isSidebarLeafActive(main, 'view=part-a', `${main}?view=part-a`)).toBe(true);
    expect(isSidebarLeafActive(main, 'view=part-a', main)).toBe(false);
  });

  it('keeps Incorporation highlighted on a client step page, so Overview leads back to the main page', async () => {
    const { incorporationGroup } = await import('./sidebar-items');
    const group = incorporationGroup('/app/lead');
    expect(isSidebarGroupActive('/app/lead/engagements/ember/step/name-application', group.items, group.activeAlso)).toBe(true);
    expect(isSidebarGroupActive('/app/manager/projects/ember/board-resolution', group.items, group.activeAlso)).toBe(true);
    expect(isSidebarGroupActive('/app/lead/tasks', group.items, group.activeAlso)).toBe(false);
  });
});
