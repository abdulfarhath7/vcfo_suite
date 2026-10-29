import { describe, expect, it } from 'vitest';
import { cardHeadIcon, tileIconName } from './card-head-icon';

describe('cardHeadIcon', () => {
  it('takes the first matching row from the top of the table', () => {
    expect(cardHeadIcon('Overdue filings')).toEqual({ icon: 'alert-triangle', tone: 'red' });
    expect(cardHeadIcon('Important alerts')).toEqual({ icon: 'bell', tone: 'amber' });
    expect(cardHeadIcon('Waiting for your approval')).toEqual({ icon: 'circle-check', tone: 'green' });
  });

  it('matches word starts, so plurals and longer forms match', () => {
    expect(cardHeadIcon('Approvals')).toEqual({ icon: 'circle-check', tone: 'green' });
    expect(cardHeadIcon('Recent documents')).toEqual({ icon: 'file', tone: 'amber' });
    expect(cardHeadIcon('Compliance status')).toEqual({ icon: 'shield-check', tone: 'green' });
  });

  it('matches multi-word rows and ignores case', () => {
    expect(cardHeadIcon('What SBC is doing')).toEqual({ icon: 'clipboard-check', tone: 'teal' });
    expect(cardHeadIcon('WHAT IS NEXT')).toEqual({ icon: 'calendar', tone: 'teal' });
  });

  it('does not match a word inside another word', () => {
    // "plan" must not match inside "explanation"; nothing else matches either.
    expect(cardHeadIcon('Explanation')).toEqual({ icon: 'layout-grid', tone: 'blue' });
  });

  it('falls back to the grid icon in blue', () => {
    expect(cardHeadIcon('Preview')).toEqual({ icon: 'layout-grid', tone: 'blue' });
  });
});

describe('tileIconName', () => {
  it('gives every home tile label a glyph of its own, like the prototype', () => {
    expect(tileIconName('Clients')).toBe('building');
    expect(tileIconName('Incorporating')).toBe('rocket');
    expect(tileIconName('Done today')).toBe('check-check');
    expect(tileIconName('Jobs failed today')).toBe('circle-alert');
    expect(tileIconName('Messages failed')).toBe('message-warning');
    expect(tileIconName('Expected COI')).toBe('award');
    expect(tileIconName('Waiting on clients')).toBe('user');
    expect(tileIconName('Due this week')).toBe('calendar-days');
    expect(tileIconName('Filings overdue')).toBe('alert-triangle');
    expect(tileIconName('Filed on time')).toBe('check-circle');
    expect(tileIconName('Not started')).toBe('circle-dashed');
  });

  it('falls back to the card-head table', () => {
    expect(tileIconName('Recent activity')).toBe('clock');
  });

  it('leaves no current home tile on the grid icon', () => {
    const labels = ['Needs action', 'Overdue', 'Need attention', 'Awaiting review', 'Documents in', 'With SBC',
      'Due soon', 'Filings due', 'Incorporated', 'In progress', 'Registrations', 'Services working',
      'Outlook mailboxes', 'Denied, 7 days', 'Stuck', 'In compliance'];
    for (const l of labels) expect(tileIconName(l), l).not.toBe('layout-grid');
  });
});
