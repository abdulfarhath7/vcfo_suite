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
  /**
   * Where the file came from when it is not a new upload or a new SharePoint file: `app` for a
   * document already in the app, `stored` for a SharePoint file an earlier fetch read, unchanged.
   * Either way only its values go on the card; the file itself is already where it belongs.
   */
  origin?: 'app' | 'stored';
  /** How long the read took, in milliseconds. */
  ms?: number;
  /** How many values the read found. */
  values?: number;
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

/**
 * A fetch for one project (PLAN M4): its SharePoint folder, the documents already in the app, or
 * both. The kind stays `sharepoint` for runs stored before 26 Nov 2026.
 */
export interface DropSharepointSource {
  kind: 'sharepoint';
  engagementId: string;
  /** The folder name as SharePoint shows it, for the messages. Empty when SharePoint is not read. */
  folderName: string;
  /** True once the files were copied into the drop, so a retry does not copy them again. */
  pulled?: boolean;
  /** False when the SharePoint folder is not read (not set up, not linked); absent means it is. */
  sharepoint?: boolean;
  /** Also read the project's documents already in the app. */
  appDocs?: boolean;
  /** True once the app's documents were added, so a retry does not add them again. */
  appPulled?: boolean;
  /** The client's name, for the messages when there is no folder name. */
  companyName?: string;
  /**
   * A fetch that a fill asked for reads the whole folder, every sub-folder included, within the
   * fetch limits (`FETCH_MAX_FILES`, `FETCH_MAX_BYTES`) instead of the drop's 50 files.
   */
  wholeFolder?: boolean;
}

/** The words for where a fetch reads from: "the SharePoint folder X and the documents in the app". */
export function fetchSourceWords(source: DropSharepointSource): string {
  const folder = source.sharepoint !== false && source.folderName ? `the SharePoint folder ${source.folderName}` : '';
  const app = source.appDocs ? `the documents in the app${!folder && source.companyName ? ` for ${source.companyName}` : ''}` : '';
  return [folder, app].filter(Boolean).join(' and ') || 'the SharePoint folder';
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
