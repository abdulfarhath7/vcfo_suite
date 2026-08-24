import { describe, expect, it } from 'vitest';
import { isSidebarGroupActive, type SidebarNavLeaf } from '@/components/shell/SidebarNavGroup';

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
});
