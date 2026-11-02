import { describe, expect, it } from 'vitest';
import { Terminal } from 'lucide-react';
import { tabBarTabs } from './TabBar';

/** P-256: the developer's phone tab bar is Overview, Jobs (Terminal icon), Connections. */
describe('tabBarTabs developer', () => {
  it('gives the developer three tabs with the Terminal icon on Jobs', () => {
    const tabs = tabBarTabs('developer');
    expect(tabs.map((t) => t.label)).toEqual(['Overview', 'Jobs', 'Connections']);
    expect(tabs[1].Icon).toBe(Terminal);
  });
});
