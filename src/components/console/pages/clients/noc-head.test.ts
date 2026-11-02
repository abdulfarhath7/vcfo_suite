import { describe, expect, it } from 'vitest';
import type { NocState } from '@/lib/noc/state';
import { nocHeadStatus, nocHeadVariant } from './noc-head';

const day = (ts: string) => `${Number(ts.slice(8, 10))} Oct`;

function state(done: string[], over: Partial<Pick<NocState, 'accepted' | 'sentBack' | 'variantLabel'>> = {}): Pick<NocState, 'track' | 'accepted' | 'sentBack' | 'variantLabel'> {
  const keys = ['drafted', 'released', 'signed', 'notarised', 'apostilled', 'accepted'] as const;
  return {
    variantLabel: 'NOC — Foreign subsidiary',
    track: keys.map((key, i) => ({ key, label: key, done: done.includes(key), ...(done.includes(key) ? { at: `2026-10-${String(i + 2).padStart(2, '0')}T05:00:00Z` } : {}) })),
    accepted: done.includes('accepted'),
    sentBack: null,
    ...over,
  };
}

describe('nocHeadStatus', () => {
  it('reads the step words from the track, newest step first', () => {
    expect(nocHeadStatus(null, day)).toBeNull();
    expect(nocHeadStatus(state([]), day)).toEqual({ kind: 'mut', icon: 'clock', text: 'Not drafted yet' });
    expect(nocHeadStatus(state(['drafted']), day)).toEqual({ kind: 'mut', icon: 'clock', text: 'Drafted · 2 Oct' });
    expect(nocHeadStatus(state(['drafted', 'released']), day)).toEqual({ kind: 'up', icon: 'clock', text: 'Released · 3 Oct · waiting for the signed copy' });
    expect(nocHeadStatus(state(['drafted', 'released', 'signed']), day)).toEqual({ kind: 'due', icon: 'clock', text: 'Signed copy in · 4 Oct · check it' });
    expect(nocHeadStatus(state(['drafted', 'released', 'signed', 'notarised', 'apostilled', 'accepted']), day)).toEqual({ kind: 'ok', icon: 'check', text: 'Accepted · 7 Oct' });
  });

  it('shows a send back with its date until the copy is accepted', () => {
    const back = { at: '2026-10-11T05:00:00Z', reason: 'No letterhead' };
    expect(nocHeadStatus(state(['drafted', 'released', 'signed'], { sentBack: back }), day)).toEqual({ kind: 'over', icon: 'alert', text: 'Sent back · 11 Oct' });
    expect(nocHeadStatus(state(['drafted', 'released', 'signed', 'accepted'], { sentBack: back }), day)?.kind).toBe('ok');
  });

  it('omits a date the record does not hold', () => {
    const s = state(['drafted']);
    delete s.track[0]!.at;
    expect(nocHeadStatus(s, day)?.text).toBe('Drafted');
  });
});

describe('nocHeadVariant', () => {
  it('names the variant and the number of steps', () => {
    expect(nocHeadVariant(null)).toBe('');
    expect(nocHeadVariant(state([]))).toBe('NOC — Foreign subsidiary · 6 steps');
    expect(nocHeadVariant({ variantLabel: 'NOC — Indian subsidiary (investing)', track: [] })).toBe('NOC — Indian subsidiary (investing)');
  });
});
