/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SpectrumTabs } from './spectrum-tabs';
import { Tabs, TabsList, TabsTrigger } from './tabs';
import { TAB_ACTIVE, TAB_INACTIVE } from './tab-classes';
import { SectionTabs } from '@/components/admin/CreateProjectSectionTabs';

const items = [
  { key: 'a', label: 'Overview' },
  { key: 'b', label: 'Documents' },
  { key: 'c', label: 'Activity' },
];

function classesOf(el: HTMLElement) {
  return el.className.split(/\s+/);
}

/** GL-03: one open-tab look (underline, bold brand text) in every tab bar. */
describe('active tab style', () => {
  it('marks the open tab with an underline, bold brand text and aria-selected, not colour alone', () => {
    expect(TAB_ACTIVE).toContain('font-semibold');
    expect(TAB_ACTIVE).toContain('text-brand-text');
    expect(TAB_ACTIVE).toMatch(/shadow-\[inset_0_-3px_0_0_oklch\(var\(--brand\)\)\]/);
    expect(TAB_INACTIVE).toContain('text-ink-muted');
    expect(TAB_INACTIVE).not.toMatch(/shadow|font-semibold/);
  });

  it('gives the underline SpectrumTabs one selected tab with the shared look', () => {
    render(<SpectrumTabs variant="underline" items={items} value="b" onChange={() => {}} label="Views" />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    const open = screen.getByRole('tab', { name: 'Documents' });
    for (const c of TAB_ACTIVE.split(' ')) expect(classesOf(open)).toContain(c);
    const closed = screen.getByRole('tab', { name: 'Overview' });
    expect(classesOf(closed)).not.toContain('font-semibold');
    expect(classesOf(closed)).toContain('text-ink-muted');
  });

  it('keeps the segmented switch on the R-11 blurple fill, like Before / After', () => {
    render(<SpectrumTabs variant="segmented" items={items} value="b" onChange={() => {}} label="Views" />);
    expect(screen.getByRole('tablist').getAttribute('data-tabs')).toBe('segmented');
    const open = screen.getByRole('tab', { name: 'Documents' });
    expect(classesOf(open)).toEqual(expect.arrayContaining(['bg-brand', 'text-on-brand']));
    expect(classesOf(open)).not.toContain('bg-brand-soft');
    expect(classesOf(screen.getByRole('tab', { name: 'Overview' }))).not.toContain('bg-brand');
  });

  it('gives the Radix TabsTrigger the same open-tab look and no filled pill', () => {
    render(
      <Tabs value="b">
        <TabsList>
          <TabsTrigger value="a">Overview</TabsTrigger>
          <TabsTrigger value="b">Documents</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const open = screen.getByRole('tab', { name: 'Documents' });
    expect(open).toHaveAttribute('aria-selected', 'true');
    expect(open.className).toContain('data-[state=active]:text-brand-text');
    expect(open.className).toContain('data-[state=active]:font-semibold');
    expect(open.className).not.toContain('data-[state=active]:bg-brand ');
    expect(open.className).not.toContain('text-on-brand');
  });

  it('gives the create-project section tabs the shared look', () => {
    const complete = { entity: true, team: false, client: false, questionnaire: false };
    render(<SectionTabs active="team" complete={complete} onSelect={() => {}} />);
    const open = screen.getByRole('tab', { name: /Team/ });
    expect(open).toHaveAttribute('aria-selected', 'true');
    for (const c of TAB_ACTIVE.split(' ')) expect(classesOf(open)).toContain(c);
    expect(classesOf(open)).not.toContain('bg-brand');
    expect(screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
  });
});
