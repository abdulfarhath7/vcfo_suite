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
  { to: '/app/intern/vault', label: 'Vault', icon: () => null },
  { to: '/app/intern/knowledge-bank', label: 'Knowledge Bank', icon: () => null },
];

describe('sidebar nav groups', () => {
  it('treats vault and knowledge-bank as the Docs section', () => {
    expect(isSidebarGroupActive('/app/intern/vault', leaves)).toBe(true);
    expect(isSidebarGroupActive('/app/intern/knowledge-bank', leaves)).toBe(true);
    expect(isSidebarGroupActive('/app/intern/today', leaves)).toBe(false);
  });

  it('lights the Compliances group on either child, for every shell base', () => {
    for (const base of ['/app/client', '/app/intern', '/app/manager', '/app/admin']) {
      const leaves = complianceLeaves(base);
      expect(leaves.map((leaf) => leaf.label)).toEqual(['Calendar', 'Filings']);
      expect(leaves.map((leaf) => leaf.to)).toEqual([
        `${base}/compliances/calendar`,
        `${base}/compliances/filings`,
      ]);
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
    expect(compliancesBasePath('intern', '/app/manager')).toBe('/app/intern');
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
