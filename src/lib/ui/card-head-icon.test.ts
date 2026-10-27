import { describe, expect, it } from 'vitest';
import { cardHeadIcon } from './card-head-icon';

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
