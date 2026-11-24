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
export const FILL_MODES: readonly FillMode[] = ['manual', 'auto'];

export type FillRunStatus = 'running' | 'waiting_user' | 'done' | 'stopped' | 'failed';
export type FillStepStatus = 'pending' | 'active' | 'done' | 'stopped';

/** Where the browser keeps the person's chosen mode. */
export const FILL_MODE_STORAGE_KEY = 'vcfo.ask.fillMode';
/** The window event the card fires once a fill has started, for the live player. */
export const FILL_START_EVENT = 'vcfo:ask-fill-start';

export type FillRunView = {
  id: string;
  status: 'running' | 'waiting_user' | 'done' | 'stopped' | 'failed';
  mode: 'manual' | 'auto';
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
  stopReason?: string;
}

export interface FillState {
  changesetId: string;
  engagementId: string;
  companyName: string;
  mode: FillMode;
  current: string | null;
  stopReason?: string;
  steps: FillStepState[];
  /** The closing chat message, once written. */
  answerMessageId?: string;
}
