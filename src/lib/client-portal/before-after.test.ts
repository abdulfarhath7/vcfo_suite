import { describe, expect, it } from 'vitest';
import { effectiveAfter, showsBeforeAfterSwitch } from '@/lib/client-portal/types';

const prefs = (viewState: 'auto' | 'before' | 'after') => ({ viewState }) as never;

describe('Before/After switch (D4)', () => {
  it('shows for a client without a COI date and follows the stored choice', () => {
    const shell = { incorporated: false, prefs: prefs('after'), coiDate: null, viewer: 'client' as const };
    expect(showsBeforeAfterSwitch(shell)).toBe(true);
    expect(effectiveAfter(shell)).toBe(true);
    expect(effectiveAfter({ ...shell, prefs: prefs('auto') })).toBe(false);
  });

  it('hides for a client once the COI date is recorded, and the view is After', () => {
    const shell = { incorporated: true, prefs: prefs('before'), coiDate: '2026-10-01', viewer: 'client' as const };
    expect(showsBeforeAfterSwitch(shell)).toBe(false);
    expect(effectiveAfter(shell)).toBe(true);
  });

  it('stays for staff who preview the client view', () => {
    const shell = { incorporated: true, prefs: prefs('before'), coiDate: '2026-10-01', viewer: 'staff' as const };
    expect(showsBeforeAfterSwitch(shell)).toBe(true);
    expect(effectiveAfter(shell)).toBe(false);
  });
});
