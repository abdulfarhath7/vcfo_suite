/**
 * The shapes of an Ask VCFO drop. A drop is an `ask_runs` row with `workflow: 'drop'`; everything the
 * job knows about it lives in that row's `state` column as a `DropState`. The files link to the run
 * through `ask_attachments.run_id`, and a file unpacked from a ZIP also carries `parent_id`.
 *
 * This file holds types and constants only, so the browser, the routes, the job and the tests can all
 * import it.
 */

export const DROP_WORKFLOW = 'drop';

/** The Inngest event that runs one drop. Its data is `{ runId }`. */
export const ASK_DROP_EVENT = 'ask/drop.run';

export const DROP_STATUSES = ['queued', 'running', 'waiting_reply', 'waiting_approval', 'done', 'failed', 'over_budget'] as const;
export type DropStatus = (typeof DROP_STATUSES)[number];

/** The statuses in which the job is still working, so the panel keeps polling. */
export const DROP_ACTIVE_STATUSES: readonly DropStatus[] = ['queued', 'running'];

export type DropFileStatus = 'queued' | 'read' | 'placed' | 'skipped' | 'failed';

export interface DropFile {
  attachmentId: string;
  /** The folder path and file name as dropped, or the path inside its ZIP. */
  path: string;
  size: number;
  status: DropFileStatus;
  docType?: string;
  engagementId?: string;
  /** Where the file is going, in words the person reads, for example "Labour register: paysheet". */
  destination?: string;
  /** Why it was skipped, failed or left unplaced. Identity numbers are masked. */
  reason?: string;
}

/** One review card, for one client. */
export interface DropGroup {
  engagementId: string;
  companyName: string;
  changesetId: string;
}

/** A file the drop could not place, waiting for the "Where should these go?" answer. */
export interface DropUnplaced {
  attachmentId: string;
  path: string;
  reason: string;
}

export interface DropProgress {
  done: number;
  total: number;
  label: string;
}

export interface DropState {
  files: DropFile[];
  groups: DropGroup[];
  unplaced: DropUnplaced[];
  progress: DropProgress;
  /** What the person asked for, with identity numbers masked. Empty until the drop is started. */
  instruction: string;
  /** The page the person was on when they started the drop, a hint for the client. */
  page?: { path: string };
  /** The closing assistant message the job wrote into the conversation. */
  answerMessageId?: string;
  /** Set once a file was left unread because the drop used its token budget. */
  overBudget?: boolean;
  /** Questions and notes from sorting, for the closing message. Identity numbers are masked. */
  notes?: string[];
  /**
   * Set when the files come from the client's SharePoint folder instead of an upload. The folder's
   * Graph ids stay on the project row, not here, because the run state is masked.
   */
  source?: DropSharepointSource;
  /**
   * Set when the person asked to fetch and then fill in one message ("fetch Bonterra's data and
   * put it in name application"): once the card is ready, the finish step starts the fill on it.
   */
  fillAfter?: DropFillAfter;
}

export interface DropFillAfter {
  mode: 'manual' | 'auto';
  /** The chip's mode when it differs from `mode` (Auto with "Watch it fill" runs as Manual). */
  chip?: 'manual' | 'auto';
  /** The steps the request named; absent means every step on the card. */
  scope?: { stepIds: string[]; label: string };
  /** Set once the finish step tried the fill, so a retry does not start it twice. */
  started?: boolean;
  /** The fill run, when one started. */
  runId?: string;
}

export interface DropSharepointSource {
  kind: 'sharepoint';
  engagementId: string;
  /** The folder name as SharePoint shows it, for the messages. */
  folderName: string;
  /** True once the files were copied into the drop, so a retry does not copy them again. */
  pulled?: boolean;
}

export function emptyDropState(): DropState {
  return { files: [], groups: [], unplaced: [], progress: { done: 0, total: 0, label: 'Waiting for files' }, instruction: '' };
}

/** What GET /api/ask/runs/:id returns. */
export interface DropRunView {
  id: string;
  status: string;
  progress: DropProgress;
  files: DropFile[];
  groups: DropGroup[];
  unplaced: DropUnplaced[];
  answerMessageId: string | null;
}
