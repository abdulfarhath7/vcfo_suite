import {
  isNotificationKind,
  type AppNotification,
} from '@/lib/checklist-notifications';

/** Slide + fade duration for a dismissed notification row. */
export const NOTIFICATION_ROW_EXIT_MS = 300;

/** Extra delay between rows on clear-all (same rightward exit). */
export const NOTIFICATION_ROW_EXIT_STAGGER_MS = 40;

/** Undo toast lifetime — deletion stays if ignored. */
export const NOTIFICATION_UNDO_TOAST_MS = 7000;

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
