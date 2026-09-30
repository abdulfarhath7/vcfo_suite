import { describe, expect, it } from 'vitest';
import { allowedDates, extractDates, validateAnswer } from '@/lib/ask/validate';

const base = { citations: [], actions: [], origin: 'generated', depth: 'normal' } as const;
const ctx = (over: Partial<Parameters<typeof validateAnswer>[1]> = {}) => ({
  shell: 'client' as const,
  allowedCitationIds: new Set<string>(['gst-basics', 'getUpcomingCompliances']),
  toolResultTexts: [] as string[],
  ...over,
});

describe('extractDates', () => {
  it('finds ISO, Indian numeric and written dates, but not durations', () => {
    expect(extractDates('Due 2026-10-20, or 20/10/2026, or 20 October 2026, or Oct 20, 2026.').sort()).toEqual([
      '2026-10-20',
    ]);
    expect(extractDates('File within 30 days and 180 days of incorporation in 2017.')).toEqual([]);
    expect(extractDates('It is due on 7 November.')).toEqual(['--11-07']);
  });
});

describe('validateAnswer', () => {
  it('rejects a date that no tool returned this turn', () => {
    const result = validateAnswer({ ...base, line: 'Your GSTR-3B is due on 20 October 2026.' }, ctx());
    expect(result.ok).toBe(false);
    expect('errors' in result && result.errors.join(' ')).toContain('2026-10-20');
  });

  it('accepts a date that came from the calendar tool, in any format', () => {
    const toolResultTexts = [JSON.stringify([{ name: 'GSTR-3B', dueDate: '2026-10-20' }])];
    expect(allowedDates(toolResultTexts).has('2026-10-20')).toBe(true);
    const result = validateAnswer(
      { ...base, line: 'Your GSTR-3B is due on 20 October 2026.', citations: [{ id: 'getUpcomingCompliances', label: 'Calendar' }] },
      ctx({ toolResultTexts }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects citations that were not retrieved or called', () => {
    const result = validateAnswer({ ...base, line: 'GST is a tax.', citations: [{ id: 'made-up', label: 'x' }] }, ctx());
    expect(result.ok).toBe(false);
  });

  it('rejects staff visuals for a client and step ids outside the active catalog', () => {
    expect(
      validateAnswer({ ...base, line: 'x', visual: { type: 'metrics', items: [{ k: 'a', v: '1' }, { k: 'b', v: '2' }] } }, ctx()).ok,
    ).toBe(false);
    expect(validateAnswer({ ...base, line: 'See step reg-2 for PAN.' }, ctx()).ok).toBe(false);
    expect(validateAnswer({ ...base, line: 'See step pre-14.' }, ctx()).ok).toBe(true);
  });

  it('rejects a malformed visual', () => {
    expect(validateAnswer({ ...base, line: 'x', visual: { type: 'pie', slices: [] } }, ctx()).ok).toBe(false);
  });
});
