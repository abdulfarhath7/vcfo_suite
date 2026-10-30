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
  /** The kind of service, for the Kind filter: Email, Messaging, Storage and so on. */
  kind: string;
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
  /** Uptime, p95 and last check per service, from the stored live checks. */
  health: ServiceHealth[];
  /** Account, endpoint, scopes and expiry per service. */
  meta: ServiceMeta[];
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
  /** The WhatsApp template the message used, or null. */
  template?: string | null;
  /** When the provider last changed its status. */
  updatedAt?: string | null;
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
  /** Delivery rows per status for the channel filter, for the tab counts. */
  statusCounts?: Record<string, number>;
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
  /** The `dev/run.<id>` event the job also listens to, so "Run now" can start it; null when it does not. */
  runEvent?: string | null;
}

export interface JobRun {
  id: string;
  /** The Inngest event that started the run (its internal id), for a retry. */
  eventId: string | null;
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
  /** "Pause all jobs" (`dev_settings` key 'jobs.paused'). */
  paused: { on: boolean; by: string | null; at: string | null };
}

/** The picked run: what Inngest says about it, and the app log lines from its window. */
export interface JobRunDetail {
  run: Reach<{ id: string; status: string; startedAt: string | null; endedAt: string | null; output: string | null }>;
  lines: Reach<LogLine[]>;
}

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogLine {
  id: string;
  at: string;
  level: LogLevel;
  stream: string;
  /** Message with email addresses and phone numbers masked. */
  message: string;
  /** The tag the line starts with, such as "[audit]" or a JSON "source" field, or "". */
  source: string;
  /** A request id found in the line, or "". */
  requestId: string;
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
  /** The full image identifier, for "Roll back". */
  imageIdentifier?: string | null;
  /** Whether a push to the image tag redeploys on its own. */
  autoDeploy?: boolean | null;
  /** The IAM role the app runs as (a service account, not a secret). */
  instanceRole?: string | null;
  /** Env var names stored as App Runner secrets (Secrets Manager or SSM), names only. */
  secretNames?: string[];
  /** Plain env var names on the service, names only. */
  envNames?: string[];
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
  /** Short before and after values, when the event stored them in its metadata. */
  before?: string | null;
  after?: string | null;
}

export interface AuditPayload {
  events: AuditRow[];
  nextBefore: string | null;
}

/** One cost group on the overview bar. */
export interface CostGroup {
  group: 'AI' | 'App Runner' | 'Database' | 'Messaging' | 'Other';
  amount: number;
}

export interface OverviewPayload {
  services: ServiceConfig[];
  outlook: { connected: number; expiringSoon: number; healthy: number };
  /** Required secrets that are not set, and seeded demo logins that still work. */
  secrets: { missing: string[]; demoLogins: number };
  /** Error lines in the app log in 24 hours, and all lines read (capped at the reader limit). */
  errors24h: Reach<{ errors: number; lines: number; capped: boolean }>;
  /** Spend from the first of this month to today, in five groups. */
  costsMonth: Reach<{ currency: string; start: string; end: string; total: number; groups: CostGroup[] }>;
  messages: MessagesPayload['counts24h'];
  audit7d: { failed: number; denied: number };
  jobs: Reach<{ failedToday: number; runningNow: number; lastRuns: JobRun[] }>;
  deploy: Reach<{ status: string; image: string | null; latest: DeployOperation | null; recent: DeployOperation[] }>;
  staffSignedIn: number;
  /** Uptime, p95 and last check per service, from the stored checks of 30 days. */
  health?: ServiceHealth[];
  /** Runs of failed checks in 30 days, newest first. */
  incidents?: Incident[];
  /** The one environment the app runs in (App Runner production). */
  environment?: Reach<EnvironmentRow>;
}

// ---------- Round X: live checks, health, incidents ----------

/** One stored live check of a service (`dev_service_checks`). */
export interface ServiceCheck {
  id: string;
  service: string;
  ok: boolean;
  latencyMs: number;
  detail: string | null;
  checkedAt: string;
  /** Who ran it, by name; null for a scheduled check. */
  by: string | null;
}

/** Uptime and p95 per service over the stored checks of the last 30 days. */
export interface ServiceHealth {
  service: string;
  checks: number;
  /** Share of checks that passed, 0 to 100, or null with no checks. */
  uptime: number | null;
  /** 95th percentile check time in ms, or null with no checks. */
  p95: number | null;
  lastCheck: ServiceCheck | null;
}

/** A run of failed checks for one service: from the first failure to the next pass. */
export interface Incident {
  id: string;
  service: string;
  startedAt: string;
  /** The first passing check after the failures, or null while it is still failing. */
  endedAt: string | null;
  failedChecks: number;
  detail: string | null;
}

/** Non-secret facts about a service for the Connections page. */
export interface ServiceMeta {
  id: ServiceConfig['id'];
  /** The account the service runs under: a from address, bucket, app id. Never a secret. */
  account: string | null;
  /** Where the app talks to it: a host or region. */
  endpoint: string | null;
  /** The permissions or OAuth scopes the app uses on it, from the code. */
  scopes: string[];
  /** Whether "Test" can run a live check for it. */
  checkable: boolean;
  /** The earliest stored sign-in expiry, for services that keep one (Outlook). */
  authExpires: string | null;
}

export interface DomainRecord {
  record: 'SPF' | 'DKIM' | 'DMARC' | 'Return path';
  status: 'verified' | 'missing' | 'pending' | 'failed';
  value: string;
}

export interface DomainCheck {
  domain: string;
  records: DomainRecord[];
  checkedAt: string;
}

/** One outbound message route: an event on a channel, with 7-day numbers from the delivery log. */
export interface MessageRouteRow {
  event: string;
  channel: 'email' | 'whatsapp';
  /** The WhatsApp template name the event sends, or null for email. */
  template: string | null;
  sent7d: number;
  delivered7d: number;
  failed7d: number;
}

/** The detail sections for one picked service. */
export interface ConnectionDetailPayload {
  service: string;
  events: Array<{ id: string; at: string; text: string; ok: boolean }>;
  usedBy: MessageRouteRow[];
  /** Only for the email service. */
  domain: Reach<DomainCheck> | null;
  /** Whether "Send a test" works for this service. */
  canSendTest: boolean;
}

/** An image the production service ran, for "Roll back" (`dev_deploy_images`). */
export interface DeployImage {
  image: string;
  firstSeenAt: string;
  lastSeenAt: string;
  current: boolean;
}

/** One applied or waiting migration: the journal in the code against the database table. */
export interface MigrationRow {
  tag: string;
  status: 'applied' | 'pending';
  appliedAt: string | null;
}

/** An env flag that switches a feature on. */
export interface FeatureFlag {
  id: string;
  name: string;
  on: boolean;
  who: string;
}

export interface DeploysExtra {
  images: DeployImage[];
  migrations: Reach<MigrationRow[]>;
  flags: FeatureFlag[];
  /** Who started the last console redeploy or roll back, from the audit log. */
  lastBy: { name: string; at: string } | null;
}

export interface LogRetention {
  group: string;
  /** Days CloudWatch keeps lines, or null for "never expire". */
  days: number | null;
  storedBytes: number | null;
}

export interface BucketStat {
  bucket: string;
  region: string | null;
  versioning: string;
  lifecycleRules: number;
  objects: number;
  bytes: number;
  /** True when the count stopped at the reader's limit. */
  capped: boolean;
}

export interface MonthCost {
  month: string;
  amount: number;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  status: string;
}

export interface EmailTemplateRow {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
  lastUsed: string | null;
  sent7d: number;
}

export interface MessagesSetupPayload {
  routes: MessageRouteRow[];
  causes: Array<{ channel: string; cause: string; count: number }>;
  emailTemplates: EmailTemplateRow[];
  whatsappTemplates: Reach<WhatsAppTemplate[]>;
  domain: Reach<DomainCheck>;
  timing: { reminderDays: number[]; timezone: string; schedules: Array<{ id: string; cron: string }> };
  /** Failed mail kept 30 days for "Retry". */
  failedEmails: FailedEmailRow[];
}

export interface DevSessionRow {
  id: string;
  person: string;
  role: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface AccessExtra {
  sessions: DevSessionRow[];
  methods: { twoStep: number; passwordOnly: number };
  secrets: Array<{ name: string; scope: string; storedIn: string; set: boolean }>;
  /** Where "Stored in" was read: App Runner, or only this server's env. */
  secretsSource: 'app_runner' | 'process';
  accounts: Array<{ account: string; kind: string; can: string[]; service: string; lastUsed: string | null }>;
  /** Seeded demo logins that can still sign in. */
  demoLogins: number;
  tokens: DevTokenRow[];
}

export interface DatabaseFacts {
  version: string;
  startedAt: string | null;
  connections: number;
  maxConnections: number;
  bytes: number;
  oldestVacuum: string | null;
  deadRows: number;
}

export interface MonthVolumes {
  since: string;
  emails: number;
  whatsapp: number;
  documents: number;
  documentBytes: number;
  auditEvents: number;
  signIns: number;
}

export interface DataExtra {
  backups: Reach<RdsBackups>;
  exports: ExportRow[];
  facts: DatabaseFacts;
  volumes: MonthVolumes;
  months: Reach<{ currency: string; months: MonthCost[] }>;
  bucket: Reach<BucketStat>;
}

/** The production environment row on the overview. */
export interface EnvironmentRow {
  name: string;
  address: string | null;
  version: string | null;
  commit: string | null;
  deployedAt: string | null;
  by: string | null;
}

/** A personal API token on Access (`dev_api_tokens`); the token itself is never listed. */
export interface DevTokenRow {
  id: string;
  name: string;
  /** The first characters, for example "vcfo_dev_Ab3x". */
  prefix: string;
  by: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  status: 'active' | 'expired' | 'revoked';
}

/** A failed mail kept for retry (`failed_emails`), as the console lists it. */
export interface FailedEmailRow {
  id: string;
  /** Masked addresses. */
  to: string;
  /** Subject with emails, phones and PANs scrubbed. */
  subject: string;
  templateKey: string | null;
  error: string | null;
  attempts: number;
  /** False when the mail had attachments, which are not kept. */
  canRetry: boolean;
  createdAt: string;
  lastAttemptAt: string;
}

/** One exported file on Data and costs › Exports (`export_files`). */
export interface ExportRow {
  id: string;
  kind: string;
  format: string;
  fileName: string;
  sizeBytes: number;
  madeBy: string;
  createdAt: string;
  /** The S3 copy is still kept (30 days). */
  kept: boolean;
  /** The caller may download it: the maker or the super admin. */
  canDownload: boolean;
}

/** One RDS snapshot on Data and costs › Backups. */
export interface SnapshotRow {
  id: string;
  takenAt: string | null;
  kind: 'automated' | 'manual' | string;
  /** Allocated storage in GiB. */
  sizeGiB: number | null;
  status: string;
}

export interface RdsBackups {
  instance: string;
  engine: string;
  instanceClass: string | null;
  multiAz: boolean | null;
  retentionDays: number | null;
  backupWindow: string | null;
  latestRestorable: string | null;
  snapshots: SnapshotRow[];
}

/** Access › Console settings. */
export interface ConsoleSettings {
  paused: { on: boolean; by: string | null; at: string | null };
  retention: Reach<LogRetention>;
  testMailTo: string | null;
}
