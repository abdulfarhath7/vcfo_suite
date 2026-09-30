import { describe, expect, it } from 'vitest';
import type { ProjectSnapshot } from '@/data/ask/schema';
import { buildNudge, endOfIndiaDay, shouldShowNudge } from '@/lib/ask/nudge';
import { SNAPSHOTS } from '../../../../tests/ask/evals/golden';

const base = SNAPSHOTS.foreignCompany;
const snap = (step: ProjectSnapshot['currentStep']): ProjectSnapshot => ({ ...base, currentStep: step });

describe('C1 daily nudge', () => {
  it('shows the client-owned step waiting on the client, with its effort label', () => {
    const nudge = buildNudge(base);
    expect(nudge).toMatchObject({ stepId: 'pre-14', title: 'Registered Office Address', effortLabel: 'About 10 minutes' });
    expect(nudge?.link.dest).toEqual({ to: 'step', stepId: 'pre-14' });
  });

  it('never nudges a step the firm holds, a locked step, or when nothing is open', () => {
    expect(buildNudge(snap({ id: 'pre-4', title: 'Name Application', owner: 'lead', status: 'with the firm' }))).toBeNull();
    expect(buildNudge(snap({ id: 'pre-13', title: 'Capital Structure', owner: 'client', status: 'locked' }))).toBeNull();
    expect(buildNudge(snap(null))).toBeNull();
  });

  it('shows at most once per India day and respects a dismissal', () => {
    const now = new Date('2026-10-01T06:00:00Z'); // 11:30 IST
    expect(shouldShowNudge(null, now)).toBe(true);
    expect(shouldShowNudge({ lastNudgeAt: new Date('2026-10-01T03:00:00Z'), dismissedUntil: null }, now)).toBe(false);
    expect(shouldShowNudge({ lastNudgeAt: new Date('2026-09-30T10:00:00Z'), dismissedUntil: null }, now)).toBe(true);
    // 19:00 UTC on 30 Sep is 00:30 IST on 1 Oct — same India day.
    expect(shouldShowNudge({ lastNudgeAt: new Date('2026-09-30T19:00:00Z'), dismissedUntil: null }, now)).toBe(false);
    expect(shouldShowNudge({ lastNudgeAt: null, dismissedUntil: endOfIndiaDay(now) }, now)).toBe(false);
    expect(endOfIndiaDay(now).toISOString()).toBe('2026-10-01T18:29:59.999Z');
  });
});
