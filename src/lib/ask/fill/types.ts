/**
 * The shapes of an Ask VCFO fill run: "Fill into app" on a review card. A fill is an `ask_runs` row
 * with `workflow: 'fill'`; its `state` holds a `FillState` (step ids, statuses and stop reasons only,
 * never a value). The values stay on the card's rows.
 *
 * Types and constants only, so the browser, the routes, the job and the tests can import it.
 */

export const FILL_WORKFLOW = 'fill';

/** The Inngest event that runs one auto fill. Its data is `{ runId, profileId? }`. */
export const ASK_FILL_EVENT = 'ask/fill.run';

export type FillMode = 'manual' | 'auto';

/**
 * The steps one fill may work on, from the request ("name application" is Phase 1). Rows of other
 * steps stay on the card untouched. `label` names the steps in the chat.
 */
export interface FillScope {
  stepIds: string[];
  label: string;
}
export const FILL_MODES: readonly FillMode[] = ['manual', 'auto'];

export type FillRunStatus = 'running' | 'waiting_user' | 'done' | 'stopped' | 'failed';
export type FillStepStatus = 'pending' | 'active' | 'done' | 'stopped';

/** Where the browser keeps the person's chosen mode. */
export const FILL_MODE_STORAGE_KEY = 'vcfo.ask.fillMode';
/** The window event the card fires once a fill has started, for the live player. */
export const FILL_START_EVENT = 'vcfo:ask-fill-start';

/** A step's saved answers against its required ones (`src/lib/incorporation/step-completeness.ts`). */
export interface FillCompleteness {
  complete: boolean;
  missing: number;
  labels: string[];
}

export type FillRunView = {
  id: string;
  status: 'running' | 'waiting_user' | 'done' | 'stopped' | 'failed';
  mode: 'manual' | 'auto';
  /** What the person chose on the chip. Auto with "Watch it fill" runs as a browser-driven Manual run. */
  chip?: 'manual' | 'auto';
  engagementId: string;
  companyName: string;
  current: string | null;
  stopReason?: string;
  steps: Array<{
    stepId: string;
    title: string;
    status: 'pending' | 'active' | 'done' | 'stopped';
    filled: number;
    total: number;
    stopReason?: string;
    /** Required answers saved on the step now; absent for a step with no rules to read. */
    completeness?: FillCompleteness;
    /** The step was filled before it opened. */
    early?: boolean;
    /** Values this fill saved that another step now holds differently: check them. */
    checks?: Array<{ label: string; message: string }>;
    rows: Array<{
      rowId: string;
      fieldKey: string;
      fieldId: string;
      group?: string;
      entryId?: string;
      newEntry?: boolean;
      label: string;
      value: string;
      held?: string;
    }>;
  }>;
};

export interface FillStepState {
  stepId: string;
  status: FillStepStatus;
  /** Why the run stopped here, or why it left this step and went on (a step it may not fill). */
  stopReason?: string;
  /** The step was not open yet when its values were saved as a draft (PLAN K). */
  early?: boolean;
}

export interface FillState {
  changesetId: string;
  engagementId: string;
  companyName: string;
  mode: FillMode;
  /** The chip's mode, when it differs from how the server runs the fill (Auto with "Watch it fill"). */
  chip?: FillMode;
  current: string | null;
  stopReason?: string;
  steps: FillStepState[];
  /** The steps the request named, when it named some; the plan held only these. */
  scope?: FillScope;
  /** The closing chat message, once written. */
  answerMessageId?: string;
  /** Set on a "fill everything" run: what the gaps ladder did before the steps were filled. */
  ladder?: FillLadder;
  /** The draft board resolution's line for the closing message, once settled. */
  boardResolutionLine?: string;
}

/**
 * What a "fill everything" run found beyond the card (src/lib/ask/fill/everything.ts): answers it
 * filled as suggestions, answers it put on one draft "Ask client" request list, and answers it left
 * with the reason. Step ids and field labels only, never a value, because the run state is masked.
 */
export interface FillLadder {
  suggested: Array<{ stepId: string; label: string }>;
  askClient: Array<{ stepId: string; label: string }>;
  left: Array<{ stepId: string; label: string; reason: string }>;
  /** The draft request list for the client, when there was anything to ask. Never sent by the fill. */
  requestList?: { id: string; href: string; items: number };
}
