/** Messages between the side panel and the background service worker (one long-lived port). */
import type { Catalog, EngagementSummary, ProfileMissing, Run } from './types';
import type { UserEvent } from '../engine/runner';

export const PANEL_PORT = 'vcfo-panel';

export interface PortalInfo {
  tabId?: number;
  url?: string;
  host?: string;
  /** The local mock portal. */
  mock: boolean;
  /** False for a live host until Suite's catalog allows it (G11). */
  liveAllowed: boolean;
}

export interface Readiness {
  engagementId: string;
  companyName?: string;
  missing: ProfileMissing[];
  error?: string;
}

export interface PanelState {
  suite: { connected: boolean; origin?: string; error?: string };
  engagements: EngagementSummary[];
  engagementId?: string;
  readiness?: Readiness;
  catalog: Catalog;
  portal: PortalInfo;
  run: Run | null;
  /** `mcaLogin`: the last "Which MCA login are you using?" answer, to prefill (a label, never a password). */
  settings: { suiteOrigins: string[]; mcaLogin?: string };
  notice?: string;
}

export type PanelCommand =
  | { cmd: 'refresh' }
  | { cmd: 'selectEngagement'; id: string }
  | { cmd: 'start'; agentId: string; subAgentId: string; mcaLoginLabel: string }
  | { cmd: 'event'; event: UserEvent }
  | { cmd: 'reset' }
  | { cmd: 'setOrigins'; origins: string[] }
  | { cmd: 'tick' }
  /** "Fix in Suite": the engagement's step page (Suite redirects to the role's own shell). */
  | { cmd: 'openSuite'; stepId?: string }
  /** "Open in Suite" while the certifier's checks are awaited (G17): that run on the Assist runs page. */
  | { cmd: 'openCertifier' };

export type PanelMessage = { type: 'state'; state: PanelState };
