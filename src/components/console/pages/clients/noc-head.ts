/**
 * The board resolution (NOC) words for the console head, from the NOC state
 * (`GET /api/engagements/:id/board-resolution/noc`, docs/ui-port/BR-NOC-API.md).
 * One record per step: the track says what is done and when; `accepted` and
 * `sentBack` come straight from the same row. Pure, so the page and its test
 * read one answer.
 */
import type { NocState } from '@/lib/noc/state';

export interface NocHeadStatus {
  /** A prototype pill class. */
  kind: 'ok' | 'over' | 'up' | 'due' | 'mut';
  icon: 'check' | 'alert' | 'clock';
  text: string;
}

export function nocHeadStatus(noc: Pick<NocState, 'track' | 'accepted' | 'sentBack'> | null | undefined, day: (ts: string) => string): NocHeadStatus | null {
  if (!noc) return null;
  const step = (key: string) => noc.track.find((s) => s.key === key && s.done);
  const when = (ts?: string | null) => (ts ? ` · ${day(ts)}` : '');
  if (noc.accepted) return { kind: 'ok', icon: 'check', text: `Accepted${when(step('accepted')?.at)}` };
  if (noc.sentBack) return { kind: 'over', icon: 'alert', text: `Sent back${when(noc.sentBack.at)}` };
  if (step('signed')) return { kind: 'due', icon: 'clock', text: `Signed copy in${when(step('signed')?.at)} · check it` };
  if (step('released')) return { kind: 'up', icon: 'clock', text: `Released${when(step('released')?.at)} · waiting for the signed copy` };
  if (step('drafted')) return { kind: 'mut', icon: 'clock', text: `Drafted${when(step('drafted')?.at)}` };
  return { kind: 'mut', icon: 'clock', text: 'Not drafted yet' };
}

/** "NOC — Foreign subsidiary · 6 steps", for the head chip. */
export function nocHeadVariant(noc: Pick<NocState, 'variantLabel' | 'track'> | null | undefined): string {
  if (!noc) return '';
  const n = noc.track.length;
  return n ? `${noc.variantLabel} · ${n} steps` : noc.variantLabel;
}
