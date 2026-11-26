/**
 * Card agent settings (Settings > Agents, admin only; table `agent_settings`). Pure: the
 * repository reads the rows and this module turns them into one typed object with defaults.
 *
 * Every switch starts OFF. Env settings are a second, deploy-time lock: a route is live only
 * when its env is configured AND the admin switches it on, so an admin cannot turn on a route the
 * deployment cannot serve, and a deploy cannot turn one on without the admin.
 */

export interface AgentRouteSetting {
  /** The admin's switch. */
  live: boolean;
  /** Staff who may use the route while it is in pilot; empty means every staff member. */
  pilotUserIds: string[];
}

export interface AgentSettings {
  /** Stops every card agent at once: no new session, no new API call; open sessions end. */
  killSwitch: boolean;
  /** The GSTZen (GSP) API route for GST returns, notices and GSTIN checks. */
  gstzen: AgentRouteSetting;
  /** The live browser route (MCA and registrations). Portals still need their pack to be live. */
  browser: AgentRouteSetting;
  /** Cap on live browser hours per calendar month. */
  browserHoursCap: number;
  /** A live session with no activity ends after this many minutes. */
  idleMinutes: number;
  /** A live session ends after this many minutes in all. */
  maxMinutes: number;
  /** One open live session per portal login label (proposed G21). */
  onePerLogin: boolean;
}

export const AGENT_SETTINGS_DEFAULTS: AgentSettings = {
  killSwitch: false,
  gstzen: { live: false, pilotUserIds: [] },
  browser: { live: false, pilotUserIds: [] },
  browserHoursCap: 100,
  idleMinutes: 15,
  maxMinutes: 90,
  onePerLogin: true,
};

export const AGENT_SETTING_KEYS = ['killSwitch', 'gstzen', 'browser', 'browserHoursCap', 'idleMinutes', 'maxMinutes', 'onePerLogin'] as const;
export type AgentSettingKey = (typeof AGENT_SETTING_KEYS)[number];

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, d: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;

function route(v: unknown, d: AgentRouteSetting): AgentRouteSetting {
  if (!v || typeof v !== 'object') return { ...d, pilotUserIds: [...d.pilotUserIds] };
  const o = v as Record<string, unknown>;
  return {
    live: bool(o.live, d.live),
    pilotUserIds: Array.isArray(o.pilotUserIds) ? o.pilotUserIds.filter((x): x is string => typeof x === 'string').slice(0, 200) : [],
  };
}

/** Rows (key → JSON value) to settings, with defaults for anything missing or malformed. */
export function readAgentSettings(rows: ReadonlyArray<{ key: string; value: unknown }>): AgentSettings {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const d = AGENT_SETTINGS_DEFAULTS;
  return {
    killSwitch: bool(m.get('killSwitch'), d.killSwitch),
    gstzen: route(m.get('gstzen'), d.gstzen),
    browser: route(m.get('browser'), d.browser),
    browserHoursCap: int(m.get('browserHoursCap'), d.browserHoursCap, 0, 10_000),
    idleMinutes: int(m.get('idleMinutes'), d.idleMinutes, 2, 60),
    maxMinutes: int(m.get('maxMinutes'), d.maxMinutes, 10, 240),
    onePerLogin: bool(m.get('onePerLogin'), d.onePerLogin),
  };
}

/** Validates one value from the admin form; returns the clean value or null when it is not acceptable. */
export function cleanAgentSetting(key: AgentSettingKey, value: unknown): unknown | null {
  const probe = readAgentSettings([{ key, value }]);
  const v = probe[key];
  if (key === 'gstzen' || key === 'browser') return value && typeof value === 'object' ? v : null;
  if (typeof v !== typeof AGENT_SETTINGS_DEFAULTS[key]) return null;
  if (typeof AGENT_SETTINGS_DEFAULTS[key] === 'boolean' && typeof value !== 'boolean') return null;
  if (typeof AGENT_SETTINGS_DEFAULTS[key] === 'number' && typeof value !== 'number') return null;
  return v;
}

/** May this user use this route now? The kill switch wins; then the admin switch; then the pilot list. */
export function routeOpenFor(settings: AgentSettings, which: 'gstzen' | 'browser', userId: string): boolean {
  if (settings.killSwitch) return false;
  const r = settings[which];
  if (!r.live) return false;
  return r.pilotUserIds.length === 0 || r.pilotUserIds.includes(userId);
}
