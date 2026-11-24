/**
 * Step field states (S-496, S-497, S-499): the shared shapes of the `step_field_states` rows the
 * repository returns, and the words and tones a field shows on the step page. Pure.
 */

export type StepFieldStateWord = 'asked' | 'answered' | 'approved' | 'sent_back';
export type StepFieldAction = 'ask' | 'remind' | 'answered' | 'approve' | 'send_back' | 'clear';

export const STEP_FIELD_ACTIONS: readonly StepFieldAction[] = ['ask', 'remind', 'answered', 'approve', 'send_back', 'clear'];

export interface StepFieldState {
  engagementId: string;
  itemId: string;
  fieldId: string;
  state: StepFieldStateWord;
  askedAt: string | null;
  reviewedAt: string | null;
  actorId: string | null;
  updatedAt: string;
}

/** Whole days between an ISO time and now, never negative. */
function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/**
 * The 104px chip and the ST5 mark of one field (prototype step page): "Asked · 3d" teal,
 * "Review" amber (answered, waiting for a decision), "Accepted" green, "Sent back" red.
 * A field with no row is "Not asked" (outlined mark, no chip).
 */
export function fieldStatePresentation(
  s: Pick<StepFieldState, 'state' | 'askedAt'> | null | undefined,
  now: Date = new Date(),
): { chip: string | null; mark: 'done' | 'now' | 'next'; tone: 'prog' | 'teal' | 'warn' | 'bad' } {
  if (!s) return { chip: null, mark: 'next', tone: 'prog' };
  switch (s.state) {
    case 'asked': {
      const d = daysSince(s.askedAt, now);
      return { chip: d === null ? 'Asked' : `Asked · ${d}d`, mark: 'now', tone: 'teal' };
    }
    case 'answered':
      return { chip: 'Review', mark: 'now', tone: 'warn' };
    case 'approved':
      return { chip: 'Accepted', mark: 'done', tone: 'prog' };
    case 'sent_back':
      return { chip: 'Sent back', mark: 'now', tone: 'bad' };
    default:
      return { chip: null, mark: 'next', tone: 'prog' };
  }
}

/**
 * The chip a client sees next to a field SBC asked for: "Asked by SBC · 3d" (teal) for an asked
 * field and "Please correct" (red) for a field sent back. Every other state shows nothing.
 */
export function clientFieldAskChip(
  s: Pick<StepFieldState, 'state' | 'askedAt'> | null | undefined,
  now: Date = new Date(),
): { label: string; tone: 'teal' | 'bad' } | null {
  if (!s) return null;
  if (s.state === 'sent_back') return { label: 'Please correct', tone: 'bad' };
  if (s.state !== 'asked') return null;
  const d = daysSince(s.askedAt, now);
  return { label: d === null ? 'Asked by SBC' : `Asked by SBC · ${d}d`, tone: 'teal' };
}

/** The steps with fields waiting on the client, counted per step, oldest ask first. */
export function openAsksByStep(
  states: Array<Pick<StepFieldState, 'itemId' | 'state' | 'askedAt'>>,
): Array<{ itemId: string; asked: number; correct: number; oldestAskedAt: string | null }> {
  const by = new Map<string, { itemId: string; asked: number; correct: number; oldestAskedAt: string | null }>();
  for (const s of states) {
    if (s.state !== 'asked' && s.state !== 'sent_back') continue;
    const row = by.get(s.itemId) ?? { itemId: s.itemId, asked: 0, correct: 0, oldestAskedAt: null };
    if (s.state === 'asked') row.asked += 1;
    else row.correct += 1;
    if (s.askedAt && (!row.oldestAskedAt || s.askedAt < row.oldestAskedAt)) row.oldestAskedAt = s.askedAt;
    by.set(s.itemId, row);
  }
  return [...by.values()].sort((a, b) => (a.oldestAskedAt ?? '9999').localeCompare(b.oldestAskedAt ?? '9999'));
}
