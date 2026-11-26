/**
 * Pure mapping from the VCFO Assist engine's run (state machine and wait) to what the live
 * browser reports: the session status, the human gate, one plain line for the rail and the
 * "Your turn" banner, and the field list the rail ticks off. No I/O.
 */
import { GATE_LINE, type LiveFieldView, type LiveGate, type LiveSessionStatus } from '../../../src/lib/live-browser/contract';
import type { Run, RecipeGate } from '../../../extensions/vcfo-assist/src/shared/types';

export interface RunSummary {
  status: LiveSessionStatus;
  gate: LiveGate | null;
  line: string;
  fieldsTotal: number;
  fieldsDone: number;
  progressText: string;
}

const RUNNING_LINE: Partial<Record<Run['state'], string>> = {
  READY: 'Checking the switches and the recipe',
  PULL_PROFILE: 'Reading the client data from VCFO Suite',
  FILL: 'Filling the form',
  CHECK: 'Running the portal’s own check',
  RECHECK: 'Running the portal’s own check again',
  DOWNLOAD: 'Downloading the form to sign',
  ATTACH: 'Attaching the signed form',
  READ_SRN: 'Reading the SRN',
  WRITE_BACK: 'Saving the SRN in VCFO Suite',
  DONE: 'Done. The SRN is saved in VCFO Suite.',
  CANCELLED: 'Stopped.',
};

/** The login gate on the page is LOGIN; a recipe that names CAPTCHA or OTP separately keeps LOGIN (one step for the person). */
function gateFor(run: Run, gates: RecipeGate[]): LiveGate | null {
  const wait = run.wait;
  if (run.state === 'WAIT_LOGIN' || wait?.kind === 'login') return 'LOGIN';
  switch (wait?.kind) {
    case 'confirm':
      return 'CONFIRM';
    case 'teach':
      return 'TEACH';
    case 'human_step':
      return 'STEP';
    case 'wrong_page':
      return 'PAGE';
    case 'check_failed':
      return 'CHECK';
    case 'dsc':
      return 'DSC';
    case 'certifier':
      return 'CERTIFIER';
    case 'submit_pay':
      return gates.some((g) => g.kind === 'SUBMIT') ? 'SUBMIT' : 'PAY';
    default:
      return null;
  }
}

export function summarise(run: Run | null, opts: { gates?: RecipeGate[]; paused?: boolean; unattended?: boolean; pageCount?: number } = {}): RunSummary {
  if (!run) return { status: 'ready', gate: null, line: 'The portal is open. The agent starts when you watch.', fieldsTotal: 0, fieldsDone: 0, progressText: 'Waiting for a viewer' };
  const fieldsTotal = run.fields.length;
  const fieldsDone = run.fields.filter((f) => f.status === 'filled').length;
  const pages = opts.pageCount ?? 0;
  const pageWord = pages > 1 ? `Page ${run.page + 1} of ${pages} · ` : '';
  const counts = fieldsTotal ? `${fieldsDone} of ${fieldsTotal} fields` : '';
  if (run.state === 'DONE') return { status: 'done', gate: null, line: RUNNING_LINE.DONE!, fieldsTotal, fieldsDone, progressText: `Done${run.srn ? ` · SRN ${run.srn}` : ''}` };
  if (run.state === 'CANCELLED') return { status: 'cancelled', gate: null, line: RUNNING_LINE.CANCELLED!, fieldsTotal, fieldsDone, progressText: 'Stopped' };
  if (run.state === 'FAILED') {
    const line = run.error ? `Stopped: ${run.error}` : 'Stopped with an error.';
    return { status: 'failed', gate: null, line, fieldsTotal, fieldsDone, progressText: line.slice(0, 200) };
  }
  const gate = gateFor(run, opts.gates ?? []);
  if (opts.paused || opts.unattended) {
    const line = opts.unattended ? 'Paused: nobody is watching. Open live mode or the portal tab to go on.' : 'Paused. Press Resume to go on.';
    return { status: 'paused', gate, line, fieldsTotal, fieldsDone, progressText: 'Paused' };
  }
  if (gate) {
    let line = GATE_LINE[gate];
    if (run.wait?.kind === 'teach') line = `Click the field for "${run.wait.label}" on the portal tab.`;
    if (run.wait?.kind === 'human_step') line = run.wait.text;
    if (run.wait?.kind === 'check_failed') line = `The portal reported errors: ${run.wait.message.slice(0, 160)}`;
    return { status: 'your_turn', gate, line, fieldsTotal, fieldsDone, progressText: `Your turn: ${line}`.slice(0, 200) };
  }
  if (run.wait?.kind === 'suite_error') return { status: 'running', gate: null, line: run.wait.message, fieldsTotal, fieldsDone, progressText: 'Waiting for VCFO Suite' };
  const line = RUNNING_LINE[run.state] ?? 'Working';
  return { status: 'running', gate: null, line, fieldsTotal, fieldsDone, progressText: `${pageWord}${counts || line}`.slice(0, 200) };
}

/** The rail's field list. A value is shown only while the person is asked to confirm it (G13). */
export function fieldViews(run: Run | null): LiveFieldView[] {
  if (!run) return [];
  const confirming = run.wait?.kind === 'confirm';
  return run.fields.map((f) => ({
    key: f.key,
    label: f.label,
    status: f.status,
    ...(f.note ? { note: f.note } : {}),
    ...(confirming && f.status === 'planned' && f.value != null ? { value: f.value } : {}),
  }));
}
