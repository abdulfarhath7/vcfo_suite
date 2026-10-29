/**
 * Shapes shared by the developer console routes (`app/api/dev/**`) and its views
 * (`src/views/dev/*`). Nothing here carries a secret value, a token or a client's
 * name or address: the console is for engineering, not for client data (G-01).
 */

/**
 * The state of a reader that talks to an outside service (Inngest, CloudWatch, App Runner,
 * Cost Explorer). "not_set_up" means the env var it needs is missing; "unreachable" means the
 * call failed or timed out. The views draw a plain state for each.
 */
export type Reach<T> =
  | { state: 'ok'; data: T }
  | { state: 'not_set_up'; missing: string[] }
  | { state: 'unreachable'; error: string };

/** One configured service on the Connections page, read from env presence only. */
export interface ServiceConfig {
  id: 'email' | 'whatsapp' | 'storage' | 'jobs' | 'ask' | 'outlook' | 'credentials' | 'logs' | 'deploys' | 'costs';
  name: string;
  /** What the service does for the app, in a few words. */
  what: string;
  /** Provider or mode word, from a fixed list (never a raw env value). */
  provider: string;
  status: 'configured' | 'partial' | 'off';
  /** Env var names that are set. Names only. */
  present: string[];
  /** Env var names the service needs that are not set. */
  missing: string[];
}

export interface OutlookConnectionRow {
  id: string;
  /** Staff member's name; a client connection is never named. */
  person: string;
  role: string;
  /** Staff mailbox; masked when the owner is a client. */
  mailbox: string;
  expiresAt: string;
  updatedAt: string;
  connectedAt: string;
  signatureEnabled: boolean;
}

export interface ConnectionsPayload {
  services: ServiceConfig[];
  outlook: OutlookConnectionRow[];
}

export interface DeliveryRow {
  id: string;
  createdAt: string;
  event: string;
  channel: string;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  /** Masked: first letter and the domain, or the last digits of a phone. */
  to: string;
}

export interface EmailLogRow {
  id: string;
  createdAt: string;
  event: string;
  /** Step code the mail was bound to, for example "spice_part_a". */
  item: string;
  status: string;
  reason: string | null;
}

export interface MessagesPayload {
  deliveries: DeliveryRow[];
  emails: EmailLogRow[];
  /** Cursors for "Load older": the oldest createdAt in each list, or null at the end. */
  nextBefore: { deliveries: string | null; emails: string | null };
  counts24h: { sent: number; failed: number; skipped: number };
}

export interface JobFunction {
  id: string;
  name: string;
  trigger: { kind: 'cron'; cron: string } | { kind: 'event'; event: string };
  retries: number | null;
}

export interface JobRun {
  id: string;
  /** The registered function this run belongs to, when it can be told from the event. */
  functionId: string | null;
  event: string;
  status: 'Running' | 'Completed' | 'Failed' | 'Cancelled' | string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface JobsPayload {
  functions: JobFunction[];
  runs: Reach<JobRun[]>;
}

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogLine {
  id: string;
  at: string;
  level: LogLevel;
  stream: string;
  /** Message with email addresses and phone numbers masked. */
  message: string;
}

export interface LogsPayload {
  group: string | null;
  lines: Reach<LogLine[]>;
}

export interface DeployService {
  name: string;
  url: string | null;
  status: string;
  image: string | null;
  cpu: string | null;
  memory: string | null;
  updatedAt: string | null;
}

export interface DeployOperation {
  id: string;
  type: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface DeploysPayload {
  service: Reach<DeployService>;
  operations: Reach<DeployOperation[]>;
}

export interface StaffAccessRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastSeenAt: string | null;
  twoStep: boolean;
  activeSessions: number;
}

export interface AccessPayload {
  staff: StaffAccessRow[];
  /** Client accounts are only counted, never listed. */
  clients: { active: number; inactive: number; twoStep: number; activeSessions: number };
  /** People per role, every role. */
  roles: Array<{ role: string; people: number }>;
}

export interface TableStat {
  name: string;
  rows: number;
  bytes: number;
}

export interface CostLine {
  service: string;
  amount: number;
}

export interface DataPayload {
  database: { bytes: number; tables: TableStat[] };
  costs: Reach<{ currency: string; start: string; end: string; total: number; services: CostLine[] }>;
}

export interface AuditRow {
  id: string;
  createdAt: string;
  /** Staff name, or "Client" for a client actor. */
  actor: string;
  role: string;
  action: string;
  summary: string;
  result: 'ok' | 'failed' | 'denied' | string;
}

export interface AuditPayload {
  events: AuditRow[];
  nextBefore: string | null;
}

export interface OverviewPayload {
  services: ServiceConfig[];
  outlook: { connected: number; expiringSoon: number };
  messages: MessagesPayload['counts24h'];
  audit7d: { failed: number; denied: number };
  jobs: Reach<{ failedToday: number; runningNow: number; lastRuns: JobRun[] }>;
  deploy: Reach<{ status: string; latest: DeployOperation | null }>;
  staffSignedIn: number;
}
