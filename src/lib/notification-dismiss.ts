import {
  isNotificationKind,
  type AppNotification,
} from '@/lib/checklist-notifications';

/** Slide + fade duration for a dismissed notification row. */
export const NOTIFICATION_ROW_EXIT_MS = 300;

/** Extra delay between rows on clear-all (same rightward exit). */
export const NOTIFICATION_ROW_EXIT_STAGGER_MS = 40;

/** Undo toast lifetime — dismissal stays if ignored. */
export const NOTIFICATION_UNDO_TOAST_MS = 7000;

export const NOTIFICATION_INBOX_LIMIT = 80;
export const NOTIFICATION_HISTORY_LIMIT = 500;

/** Same calendar as intern work / announcements. */
export const NOTIFICATION_TZ = 'Asia/Kolkata';

export type NotificationClearScope = 'all' | 'today' | 'week';

export type NotificationHistoryGroup = 'today' | 'week' | 'earlier';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BATCH = 80;

/** Server-backed rows use UUID ids; optimistic local rows (e.g. `n…`) do not. */
export function isPersistedNotificationId(id: string): boolean {
  return UUID_RE.test(id);
}

export function parseNotificationIds(raw: unknown): string[] | null {
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BATCH) return null;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) return null;
    ids.push(item.trim());
  }
  return ids;
}

export function parseRestoreNotifications(raw: unknown): AppNotification[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_BATCH) return null;
  const out: AppNotification[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const n = item as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.id.trim()) return null;
    if (!isNotificationKind(n.kind)) return null;
    if (typeof n.title !== 'string') return null;
    if (typeof n.body !== 'string') return null;
    if (typeof n.engagementId !== 'string') return null;
    if (typeof n.companyName !== 'string') return null;
    if (n.itemId !== undefined && typeof n.itemId !== 'string') return null;
    if (typeof n.href !== 'string') return null;
    if (typeof n.createdAt !== 'string') return null;
    if (typeof n.read !== 'boolean') return null;
    if (
      n.dismissedAt !== undefined &&
      n.dismissedAt !== null &&
      typeof n.dismissedAt !== 'string'
    ) {
      return null;
    }
    out.push({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      engagementId: n.engagementId,
      companyName: n.companyName,
      itemId: typeof n.itemId === 'string' ? n.itemId : undefined,
      href: n.href,
      createdAt: n.createdAt,
      read: n.read,
      dismissedAt: typeof n.dismissedAt === 'string' ? n.dismissedAt : null,
    });
  }
  return out;
}

export function mergeNotificationsByCreatedAt(
  current: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const n of current) byId.set(n.id, n);
  for (const n of incoming) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => {
    const byDate = b.createdAt.localeCompare(a.createdAt);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });
}

export function isInboxNotification(n: Pick<AppNotification, 'dismissedAt'>): boolean {
  return !n.dismissedAt;
}

export function ymdInNotificationTz(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: NOTIFICATION_TZ });
}

function weekdayMon0Ist(date: Date): number {
  const wd = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: NOTIFICATION_TZ });
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Monday (YYYY-MM-DD) of the IST week containing `now`. Week is Mon–Sun. */
export function notificationIstMondayYmd(now: Date): string {
  const today = ymdInNotificationTz(now);
  const noon = new Date(`${today}T12:00:00+05:30`);
  return ymdInNotificationTz(addCalendarDays(noon, -weekdayMon0Ist(now)));
}

export function isCreatedAtIstToday(createdAtIso: string, now: Date): boolean {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return false;
  return ymdInNotificationTz(created) === ymdInNotificationTz(now);
}

/** Inclusive Mon–Sun IST week that contains `now` (includes today). */
export function isCreatedAtThisIstWeek(createdAtIso: string, now: Date): boolean {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return false;
  const ymd = ymdInNotificationTz(created);
  const monday = notificationIstMondayYmd(now);
  const sunday = ymdInNotificationTz(
    addCalendarDays(new Date(`${monday}T12:00:00+05:30`), 6),
  );
  return ymd >= monday && ymd <= sunday;
}

export function notificationInClearScope(
  createdAtIso: string,
  scope: NotificationClearScope,
  now: Date,
): boolean {
  if (scope === 'all') return true;
  if (scope === 'today') return isCreatedAtIstToday(createdAtIso, now);
  return isCreatedAtThisIstWeek(createdAtIso, now);
}

export function notificationsMatchingClearScope(
  items: AppNotification[],
  scope: NotificationClearScope,
  now: Date,
): AppNotification[] {
  if (scope === 'all') return items;
  return items.filter((n) => notificationInClearScope(n.createdAt, scope, now));
}

/**
 * History grouping: today; rest of this IST week (excludes today); older.
 * The "this week" *clear* action still includes today.
 */
export function notificationHistoryGroup(
  createdAtIso: string,
  now: Date,
): NotificationHistoryGroup {
  if (isCreatedAtIstToday(createdAtIso, now)) return 'today';
  if (isCreatedAtThisIstWeek(createdAtIso, now)) return 'week';
  return 'earlier';
}

export function groupNotificationsForHistory(
  items: AppNotification[],
  now: Date,
): Record<NotificationHistoryGroup, AppNotification[]> {
  const today: AppNotification[] = [];
  const week: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of items) {
    const group = notificationHistoryGroup(n.createdAt, now);
    if (group === 'today') today.push(n);
    else if (group === 'week') week.push(n);
    else earlier.push(n);
  }
  return { today, week, earlier };
}

/**
 * Cross-tenant dismiss contract: only ids owned by `ownerId` are updated.
 * The repository applies the same rule as `user_id = ctx.userId AND id IN (...)`.
 */
export function scopedDismissIds(
  requestedIds: string[],
  ownerId: string,
  rows: Array<{ id: string; userId: string }>,
): string[] {
  const owned = new Set(
    rows.filter((row) => row.userId === ownerId).map((row) => row.id),
  );
  return requestedIds.filter((id) => owned.has(id));
}

export function notificationHrefIsNavigable(href: string): boolean {
  return Boolean(href && href !== '#');
}

export function formatNotificationWhen(iso: string, now = new Date()): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      timeZone: NOTIFICATION_TZ,
    });
  } catch {
    return '';
  }
}

export function formatNotificationTimestampIst(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-IN', {
      timeZone: NOTIFICATION_TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}
