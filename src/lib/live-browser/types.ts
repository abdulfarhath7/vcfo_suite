/**
 * Client-safe live browser types and labels (the contract itself, `contract.ts`, signs with
 * node:crypto and stays on the server and in the broker; its types are imported with `import type`).
 */
import type { LiveGate, LiveSessionStatus } from './contract';

export interface LiveBrowserViewerView {
  userId: string;
  ip: string | null;
  firstAt: string;
  lastAt: string;
}

/** One live session as the routes answer it. No value, no keystroke, no frame. */
export interface LiveSessionView {
  id: string;
  engagementId: string;
  companyName: string | null;
  taskId: string;
  runId: string | null;
  startedBy: string | null;
  startedByName: string | null;
  portalHost: string | null;
  portalLoginLabel: string | null;
  status: LiveSessionStatus;
  open: boolean;
  gate: string | null;
  progressText: string | null;
  fieldsTotal: number;
  fieldsDone: number;
  node: string | null;
  egressIp: string | null;
  viewers: LiveBrowserViewerView[];
  createdAt: string;
  readyAt: string | null;
  lastActivityAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface ViewerAccess {
  token: string;
  role: 'watch' | 'act';
  streamUrl: string;
  pdfUrl: string | null;
  signedPdfUrl: string | null;
  expiresAt: string;
}

export const LIVE_STATUS_LABEL: Record<LiveSessionStatus, string> = {
  starting: 'Starting',
  ready: 'Portal open',
  your_turn: 'Your turn',
  running: 'Filling',
  paused: 'Paused',
  done: 'Done',
  cancelled: 'Stopped',
  failed: 'Failed',
  expired: 'Ended',
};

/** Short words for a gate on the card and in the rail. */
export const LIVE_GATE_SHORT: Record<LiveGate, string> = {
  LOGIN: 'log in',
  CAPTCHA: 'captcha',
  OTP: 'OTP',
  DSC: 'sign with DSC',
  SUBMIT: 'Submit',
  PAY: 'Pay',
  EVC: 'EVC',
  CONFIRM: 'confirm the values',
  CERTIFIER: "certifier's checks",
  TEACH: 'show the field',
  STEP: 'open the next part',
  PAGE: 'open the form page',
  CHECK: 'fix the errors',
};

/** Plain words for the start route's refusals. */
export const LIVE_START_ERROR: Record<string, string> = {
  kill_switch: 'Agents are switched off in Settings > Agents.',
  browser_not_configured: 'The live browser is not set up on this deployment.',
  route_closed: 'The live browser is not switched on for you yet (Settings > Agents).',
  no_recipe: 'This task cannot fill a portal yet.',
  no_start_page: 'This task has no portal page to open.',
  live_portals_disabled: 'Live portal use waits for the CS opinion.',
  login_in_use: 'That portal login already has an open live session. Finish it first.',
  hours_cap: 'The live browser hours for this month are used up.',
  browser_unavailable: 'The live browser did not answer. Try again in a minute.',
  pool_full: 'Every live browser is busy. Try again in a minute.',
  browser_start_failed: 'The live browser could not start. Try again.',
  not_found: 'This project is not in your list.',
};
