import { superOwnerOf, superStateChip } from '@/components/super/overview/super-overview-format';
import { stepNumbers } from '@/lib/client-portal/documents';
import { internOverviewPhases } from '@/lib/intern/intern-overview-progress';
import type { CurrentStepDays } from '@/lib/metrics/practice-metrics';
import type { PracticeIncorporationClient } from '@/lib/practice/practice-incorporation';

/**
 * The staff Incorporation list (`StaffPracticeIncorporation`). The page and the GL-06 Excel
 * export on the server pick and order the rows and work out the columns here, so the file
 * matches the screen.
 */

/** NV-01: the Incorporation sub-items that open this list with a view. */
export type PracticeIncorporationView = 'part-a' | 'part-b' | 'board-resolutions' | 'documents';
export type PracticeWithKey = '' | 'client' | 'sbc' | 'manager';

export const PRACTICE_WITH_WORD: Record<Exclude<PracticeWithKey, ''>, string> = { client: 'Client', sbc: 'SBC', manager: 'Manager' };

const PART_A = new Set(internOverviewPhases()[0]?.items.map((i) => i.id) ?? []);
const PART_B = new Set(internOverviewPhases()[1]?.items.map((i) => i.id) ?? []);
const BOARD_RESOLUTION_STEPS = new Set(['pre-2', 'pre-3']);

/**
 * SPICe+ Part A and Part B show the clients whose current step is in that part; Board
 * resolutions the clients at the board resolution steps; Documents every client.
 */
export function inPracticeView(view: PracticeIncorporationView | null, stepId: string | undefined): boolean {
  if (!view || view === 'documents') return true;
  if (!stepId) return false;
  if (view === 'part-a') return PART_A.has(stepId);
  if (view === 'part-b') return PART_B.has(stepId);
  return BOARD_RESOLUTION_STEPS.has(stepId);
}

/** The clients still incorporating. */
export function incorporatingClients(clients: readonly PracticeIncorporationClient[]): PracticeIncorporationClient[] {
  return clients.filter((c) => !c.summary.incorporated);
}

/** The rows of the view and the "With" filter, fewest steps done first. */
export function practiceIncorporationRows(
  all: readonly PracticeIncorporationClient[],
  view: PracticeIncorporationView | null,
  withWho: PracticeWithKey,
): PracticeIncorporationClient[] {
  return all
    .filter((c) => inPracticeView(view, c.summary.currentStep?.id))
    .filter((c) => !withWho || superOwnerOf(c.summary) === withWho)
    .sort((a, b) => a.summary.progress.done - b.summary.progress.done);
}

const STEP_NO = stepNumbers();

/**
 * The step's number in the client order ("Step 10"), as the project page shows it. The internal
 * id ("pre-7") counts differently, so showing it made one step look like two.
 */
export function practiceStepCode(stepId: string | undefined): string | null {
  const n = stepId ? STEP_NO[stepId]?.n : undefined;
  return n ? `Step ${n}` : null;
}

/** A row is late when a step is overdue, the client is blocked, or the step's window has passed. */
export function isLatePracticeRow(c: PracticeIncorporationClient, step: CurrentStepDays | undefined, today: string): boolean {
  return c.summary.stateKey === 'overdue' || c.summary.stuckReason === 'blocked' || Boolean(step?.dueOn && step.dueOn < today);
}

export const PRACTICE_INCORPORATION_EXPORT_HEAD = ['Client', 'Current step', 'Steps', 'With', 'Days', 'Next', 'Status'];

/** One client as export cells, in the order of `PRACTICE_INCORPORATION_EXPORT_HEAD`. */
export function practiceIncorporationExportCells(
  c: PracticeIncorporationClient,
  steps: Record<string, CurrentStepDays> | undefined,
): Array<string | number | null> {
  const step = steps?.[c.summary.id];
  const owner = superOwnerOf(c.summary);
  const code = practiceStepCode(c.summary.currentStep?.id);
  const title = c.summary.currentStep?.title ?? 'Every step is done';
  return [
    c.summary.companyName,
    code ? `${code} ${title}` : title,
    `${c.summary.progress.done} / ${c.summary.progress.total}`,
    owner ? PRACTICE_WITH_WORD[owner] : null,
    step?.days ?? null,
    step?.dueOn ?? c.nextDueDate ?? null,
    superStateChip(c.summary).word,
  ];
}
