import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  activity,
  complianceEvents,
  complianceInstances,
  documentRequestFiles,
  documentRequests,
  profiles,
  tasks,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import { normalizeEngagementSchedule, windowForStep } from '@/lib/projects/schedule-windows';
import { itemKey, parseItemKey, type WorkItemRef } from '@/lib/work/item-key';
import { canUseWorkTools } from '@/lib/work/work-access';
import {
  activityMatchesItem,
  auditEventMatchesItem,
  mergeActivity,
  type WorkActivityEntry,
} from '@/lib/work/item-activity';
import { stepCompletionVerdict, type StepCompletionVerdict } from '@/lib/work/step-completion';
import {
  assertEngagementAccess,
  checklistStateFromRow,
  toAppEngagement,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { listDocuments } from '@/db/repositories/documents';
import { listFilingProofs } from '@/db/repositories/client-compliances';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { signedDownloadUrl } from '@/storage/s3';

/**
 * WORK ITEMS — the one place a work item key is turned into an engagement (G-16, G-17).
 *
 * Every work repository (`work-sessions`, `work-checklist`, `time-blocks`,
 * `item-window-requests`) resolves its item through `resolveWorkItem`, so the scope
 * rule lives here once:
 *   - project lead (intern): items on engagements they lead (`intern_id` or
 *     `engagement_leads`), through `assertEngagementAccess`;
 *   - manager: items on engagements they manage (owner, co-manager, legacy admin_id);
 *   - admin / super admin: every item;
 *   - client / developer: nothing, before any query.
 * A key whose row does not exist, or sits on an engagement outside the scope, reads as
 * null, never as "forbidden", so ids cannot be probed. Step keys come back with the
 * engagement's database id even when the caller sent a legacy demo id (`e1`).
 */

export interface ResolvedWorkItem {
  key: string;
  ref: WorkItemRef;
  /** Database id of the engagement the item belongs to. */
  engagementId: string;
  engagement: EngagementDbRow;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function engagementOf(ref: WorkItemRef): Promise<string | null> {
  if (ref.kind === 'step') return getItem(ref.stepId) ? ref.engagementId : null;
  if (!UUID_RE.test(ref.id)) return null;
  if (ref.kind === 'filing') {
    const [row] = await db
      .select({ engagementId: complianceInstances.engagementId })
      .from(complianceInstances)
      .where(eq(complianceInstances.id, ref.id))
      .limit(1);
    return row?.engagementId ?? null;
  }
  if (ref.kind === 'event') {
    const [row] = await db
      .select({ engagementId: complianceEvents.engagementId })
      .from(complianceEvents)
      .where(eq(complianceEvents.id, ref.id))
      .limit(1);
    return row?.engagementId ?? null;
  }
  if (ref.kind === 'request') {
    const [row] = await db
      .select({ engagementId: documentRequests.engagementId })
      .from(documentRequests)
      .where(eq(documentRequests.id, ref.id))
      .limit(1);
    return row?.engagementId ?? null;
  }
  const [row] = await db
    .select({ engagementId: tasks.engagementId })
    .from(tasks)
    .where(eq(tasks.id, ref.id))
    .limit(1);
  // A task with no engagement is a personal to-do; the work tools key engagement work only.
  return row?.engagementId ?? null;
}

export async function resolveWorkItem(ctx: AuthContext, rawKey: string): Promise<ResolvedWorkItem | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  const ref = parseItemKey(rawKey.trim());
  if (!ref) return null;
  const engagementId = await engagementOf(ref);
  if (!engagementId) return null;
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return null;
  const normalized: WorkItemRef = ref.kind === 'step' ? { ...ref, engagementId: access.dbId } : ref;
  return { key: itemKey(normalized), ref: normalized, engagementId: access.dbId, engagement: access.row };
}

/* ------------------------------------------------------------------ detail */

export interface WorkItemFile {
  id: string;
  source: 'document' | 'proof' | 'request';
  fileName: string;
  at: string;
  /** Same-origin route that returns `{ url }` for a short-lived signed link. */
  urlRoute: string;
}

export type WorkItemCompletion =
  | StepCompletionVerdict
  | { mode: 'request'; canComplete: boolean; status: string }
  | { mode: 'none' };

export interface WorkItemDetail {
  key: string;
  engagementId: string;
  files: WorkItemFile[];
  activity: WorkActivityEntry[];
  completion: WorkItemCompletion;
  /** The manager-set window that applies to the item now (steps and filings only). */
  window: { from: string; to: string } | null;
}

async function filesFor(ctx: AuthContext, item: ResolvedWorkItem): Promise<WorkItemFile[]> {
  const { ref } = item;
  if (ref.kind === 'step') {
    const docs = await listDocuments(ctx, item.engagementId);
    return docs
      .filter((d) => d.stepId === ref.stepId)
      .map((d) => ({
        id: d.id,
        source: 'document' as const,
        fileName: d.fileName,
        at: d.createdAt,
        urlRoute: `/api/documents/${d.id}/signed-url`,
      }));
  }
  if (ref.kind === 'filing') {
    const proofs = await listFilingProofs(ctx, ref.id);
    return proofs.map((p) => ({
      id: p.id,
      source: 'proof' as const,
      fileName: p.fileName,
      at: p.uploadedAt,
      urlRoute: `/api/client/compliances/${ref.id}/proofs/${p.id}?json=1`,
    }));
  }
  if (ref.kind === 'request') {
    const rows = await db
      .select({
        id: documentRequestFiles.id,
        fileName: documentRequestFiles.fileName,
        uploadedAt: documentRequestFiles.uploadedAt,
      })
      .from(documentRequestFiles)
      .where(
        and(
          eq(documentRequestFiles.requestId, ref.id),
          eq(documentRequestFiles.engagementId, item.engagementId),
          isNull(documentRequestFiles.replacedAt),
        ),
      )
      .orderBy(desc(documentRequestFiles.uploadedAt));
    return rows.map((r) => ({
      id: r.id,
      source: 'request' as const,
      fileName: r.fileName,
      at: r.uploadedAt.toISOString(),
      urlRoute: `/api/work/request-files/${r.id}`,
    }));
  }
  return [];
}

async function labelsFor(item: ResolvedWorkItem): Promise<string[]> {
  const { ref } = item;
  if (ref.kind === 'step') return [checklistItemLabel(ref.stepId)];
  if (ref.kind === 'request') {
    const [row] = await db
      .select({ title: documentRequests.title })
      .from(documentRequests)
      .where(eq(documentRequests.id, ref.id))
      .limit(1);
    return row ? [row.title] : [];
  }
  return [];
}

async function activityFor(ctx: AuthContext, item: ResolvedWorkItem): Promise<WorkActivityEntry[]> {
  const events = await listAuditEvents(ctx, { engagementId: item.engagementId, limit: 300 });
  const fromAudit: WorkActivityEntry[] = events
    .filter((e) => auditEventMatchesItem(e.metadata, item.ref, item.key))
    .map((e) => ({
      id: `audit:${e.id}`,
      at: e.created_at,
      who: e.actor_name?.trim() || e.actor_email || 'Someone',
      text: e.summary,
      source: 'audit' as const,
    }));

  const labels = await labelsFor(item);
  let fromActivity: WorkActivityEntry[] = [];
  if (labels.length > 0) {
    const rows = await db
      .select({ event: activity, actorName: profiles.name })
      .from(activity)
      .leftJoin(profiles, eq(profiles.id, activity.actorId))
      .where(eq(activity.engagementId, item.engagementId))
      .orderBy(desc(activity.createdAt))
      .limit(200);
    fromActivity = rows
      .filter((r) => activityMatchesItem(r.event.message, labels))
      .map((r) => ({
        id: `activity:${r.event.id}`,
        at: r.event.createdAt.toISOString(),
        who: r.actorName?.trim() || 'Someone',
        text: `${r.event.kind} ${r.event.message}`.trim(),
        source: 'activity' as const,
      }));
  }
  return mergeActivity([...fromAudit, ...fromActivity]);
}

async function completionFor(ctx: AuthContext, item: ResolvedWorkItem): Promise<WorkItemCompletion> {
  const { ref } = item;
  if (ref.kind === 'step') {
    return stepCompletionVerdict({
      stepId: ref.stepId,
      role: ctx.role,
      state: checklistStateFromRow(item.engagement),
      engagement: toAppEngagement(item.engagement),
    });
  }
  if (ref.kind === 'request') {
    const [row] = await db
      .select({ status: documentRequests.status })
      .from(documentRequests)
      .where(eq(documentRequests.id, ref.id))
      .limit(1);
    const status = row?.status ?? 'pending';
    // Staff close a request with the existing PATCH /api/requests/:id { status: 'approved' }.
    return { mode: 'request', canComplete: status === 'pending' || status === 'fulfilled', status };
  }
  // Filings have no staff "filed" write route yet; the drawer links to the filing.
  return { mode: 'none' };
}

/** The manager-set window on a step or a filing, or null. */
export async function currentItemWindow(item: ResolvedWorkItem): Promise<{ from: string; to: string } | null> {
  const { ref } = item;
  if (ref.kind === 'step') {
    const window = windowForStep(normalizeEngagementSchedule(item.engagement.schedule), ref.stepId);
    return window ? { from: window.from, to: window.to } : null;
  }
  if (ref.kind === 'filing') {
    const [row] = await db
      .select({ from: complianceInstances.windowFrom, to: complianceInstances.windowTo })
      .from(complianceInstances)
      .where(eq(complianceInstances.id, ref.id))
      .limit(1);
    return row?.from && row?.to ? { from: row.from, to: row.to } : null;
  }
  return null;
}

/** Files, activity, the "Mark done" verdict and the window for the task drawer. */
export async function getWorkItemDetail(ctx: AuthContext, key: string): Promise<WorkItemDetail | null> {
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  const [files, entries, completion, window] = await Promise.all([
    filesFor(ctx, item),
    activityFor(ctx, item),
    completionFor(ctx, item),
    currentItemWindow(item),
  ]);
  return { key: item.key, engagementId: item.engagementId, files, activity: entries, completion, window };
}

/**
 * A short-lived link to one file a client uploaded against a document request. The
 * file's request must resolve as a work item for the caller, so the engagement scope
 * above applies.
 */
export async function getRequestFileUrl(
  ctx: AuthContext,
  fileId: string,
): Promise<{ url: string; fileName: string } | null> {
  if (!canUseWorkTools(ctx.role) || !UUID_RE.test(fileId)) return null;
  const [row] = await db
    .select({
      requestId: documentRequestFiles.requestId,
      engagementId: documentRequestFiles.engagementId,
      objectKey: documentRequestFiles.objectKey,
      fileName: documentRequestFiles.fileName,
    })
    .from(documentRequestFiles)
    .where(eq(documentRequestFiles.id, fileId))
    .limit(1);
  if (!row) return null;
  const item = await resolveWorkItem(ctx, itemKey({ kind: 'request', id: row.requestId }));
  if (!item || item.engagementId !== row.engagementId) return null;
  const url = await signedDownloadUrl(row.objectKey, 3600);
  return { url, fileName: row.fileName };
}
