import { getIncorporationPhases } from '@/data/checklist';

/**
 * The incorporation timeline's four parts as schedule windows (F-259). The same rule the
 * client timeline request uses when a manager approves it (`decideTimelineRequest`):
 *   Phase 1 dates  → every Phase 1 step window
 *   Phase 2 dates  → every Phase 2 step window except pre-11 and pre-12
 *   MCA review     → the pre-11 window
 *   COI            → the pre-12 window
 *   Phase 1 start to the COI → the incorporation window
 */
export type TimelinePartId = 'p1' | 'p2' | 'mca' | 'coi';

export interface TimelinePart {
  id: TimelinePartId;
  from: string;
  to: string;
}

export type WindowTarget = { kind: 'incorporation' } | { kind: 'step'; itemId: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Problems with typed dates, in plain words; empty when the parts can be saved. */
export function timelinePartProblems(parts: TimelinePart[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (!ISO.test(p.from) || !ISO.test(p.to)) out.push(`${p.id}: a date is missing`);
    else if (p.to < p.from) out.push(`${p.id}: the end is before the start`);
  }
  return out;
}

/** Each window to write, in order. Parts not given are left as they are. */
export function timelineWindows(parts: TimelinePart[]): Array<{ target: WindowTarget; window: { from: string; to: string } }> {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const phases = getIncorporationPhases();
  const out: Array<{ target: WindowTarget; window: { from: string; to: string } }> = [];
  const add = (itemId: string, part: TimelinePart | undefined) => {
    if (part) out.push({ target: { kind: 'step', itemId }, window: { from: part.from, to: part.to } });
  };
  for (const item of phases[0]?.items ?? []) add(item.id, byId.get('p1'));
  for (const item of phases[1]?.items ?? []) {
    add(item.id, byId.get(item.id === 'pre-11' ? 'mca' : item.id === 'pre-12' ? 'coi' : 'p2'));
  }
  const p1 = byId.get('p1');
  const coi = byId.get('coi');
  if (p1 && coi) out.push({ target: { kind: 'incorporation' }, window: { from: p1.from, to: coi.to } });
  return out;
}
