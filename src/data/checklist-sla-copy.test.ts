import { describe, expect, it } from 'vitest';
import { copyMentionsWorkingDaysSla, getItem } from '@/data/checklist';

describe('copyMentionsWorkingDaysSla', () => {
  it('detects playbook SLA duration copy intern must not show', () => {
    expect(copyMentionsWorkingDaysSla('2–3 working days')).toBe(true);
    expect(copyMentionsWorkingDaysSla(getItem('pre-1')!.expectedTimeline!)).toBe(true);
    expect(copyMentionsWorkingDaysSla(getItem('pre-5')!.description!)).toBe(true);
  });

  it('leaves operational intern help copy', () => {
    expect(copyMentionsWorkingDaysSla(getItem('pre-1')!.notes!)).toBe(false);
    expect(copyMentionsWorkingDaysSla(getItem('pre-2')!.description!)).toBe(false);
  });
});
