import 'server-only';
import { and, count, eq, gte, inArray, lt, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents, complianceInstances, emailSendLog, engagements, notificationDeliveries } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { assertEngagementAccess, getMyEngagement } from '@/db/repositories/engagements';
import { assertDeveloper } from '@/db/repositories/dev-scope';
import {
  addDaysYmd,
  engagementLiveAt,
  fyStartOfYmd,
  messagesFailedAsOf,
  pastDays,
  pastMonthEnds,
  clientDueSoonAsOf,
  superFilingsDueAsOf,
  trailingKnown,
  type EngagementDeleteEvent,
  type FilingHistoryRow,
  type FilingReopen,
  type HomeTrendHome,
  type HomeTrends,
} from '@/lib/metrics/home-trends';

/**
 * HOME TRENDS REPOSITORY — the past values behind the home card trend lines (R-18, C-0122).
 *
 * A series is returned only where the stored rows say what the tile showed at the end of each
 * past period (the pure rules are in `src/lib/metrics/home-trends.ts`). Tiles whose past
 * cannot be known get no series and draw no line. What each home gets:
 *
 *   super   clients      engagements that existed and were not deleted at each month end
 *                        (created_at, deleted_at, and the project.deleted / project.restored
 *                        audit events for projects deleted and later restored)
 *           filingsDue   filings not filed and due by 30 days after each month end, from
 *                        due_date, filed_on, created_at and the compliance.reopened events
 *   dev     messagesFailed  email and WhatsApp rows written in the 24 hours before each day
 *                        end that had failed by then (status, created_at, updated_at)
 *           denied       audit events with result "denied" in the 7 days before each day end
 *   client  dueSoon      filings of the year due within 15 days of each day and not filed
 *   lead, manager, admin nothing yet. Their tiles count step states (needs action, overdue,
 *                        waiting, approvals, stuck), the project stage and task completion.
 *                        `engagement_step_events` only holds history from the day it shipped,
 *                        the stage has no history and tasks keep no completion time, so no
 *                        past value of those tiles can be rebuilt today.
 *
 * Tiles with no line and why: developer Jobs failed (the Inngest list is capped, so older days
 * would be short), Services working and Outlook mailboxes (only the current state is kept);
 * super admin Need attention and Awaiting review (step states); client Waiting, With SBC,
 * Overdue and Documents in (step states, and requests keep no fulfilled time).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   super  — firm-wide admins only (`isFirmWideAdmin`), like the super admin overview.
 *   dev    — developer or super admin (`assertDeveloper`); counts only, nothing names a client.
 *   client — the caller's own engagement (`getMyEngagement`), or an engagement id that
 *            `assertEngagementAccess` approves; anything else reads as no trends.
 *   lead / manager / admin — the matching role; they return no series and touch no table.
 * Nothing here writes.
 */

export class HomeTrendsError extends Error {
  constructor(
    message: string,
    readonly status: 403,
  ) {
    super(message);
  }
}

const DAY_MS = 86_400_000;

export interface HomeTrendsOptions {
  /** Client home: the engagement shown (staff preview). Clients default to their own. */
  engagementId?: string;
  now?: Date;
}

export async function getHomeTrends(ctx: AuthContext, home: HomeTrendHome, opts: HomeTrendsOptions = {}): Promise<HomeTrends> {
  const now = opts.now ?? new Date();
  switch (home) {
    case 'lead':
      if (ctx.role !== 'intern') throw new HomeTrendsError('Only project leads have this home', 403);
      return {};
    case 'manager':
      if (!isAdminOrManager(ctx.role)) throw new HomeTrendsError('Only managers and admins have this home', 403);
      return {};
    case 'admin':
      if (!isFirmWideAdmin(ctx.role)) throw new HomeTrendsError('Only firm admins have this home', 403);
      return {};
    case 'super':
      if (!isFirmWideAdmin(ctx.role)) throw new HomeTrendsError('Only firm-wide admins have this home', 403);
      return superTrends(now);
    case 'dev':
      try {
        assertDeveloper(ctx);
      } catch {
        throw new HomeTrendsError('Only developers have this home', 403);
      }
      return devTrends(now);
    case 'client':
      return clientTrends(ctx, opts.engagementId, now);
  }
}

/** Drops empty series, so a tile without history simply has no key. */
function keep(series: Record<string, number[]>): HomeTrends {
  return Object.fromEntries(Object.entries(series).filter(([, v]) => v.length > 0));
}

function reopensFrom(rows: Array<{ metadata: unknown; createdAt: Date }>): FilingReopen[] {
  const out: FilingReopen[] = [];
  for (const row of rows) {
    const m = (row.metadata ?? {}) as { instanceId?: unknown; previousFiledOn?: unknown };
    if (typeof m.instanceId !== 'string') continue;
    out.push({
      instanceId: m.instanceId,
      previousFiledOn: typeof m.previousFiledOn === 'string' ? m.previousFiledOn : null,
      at: row.createdAt,
    });
  }
  return out;
}

const filingColumns = {
  id: complianceInstances.id,
  engagementId: complianceInstances.engagementId,
  dueDate: complianceInstances.dueDate,
  status: complianceInstances.status,
  filedOn: complianceInstances.filedOn,
  createdAt: complianceInstances.createdAt,
};

/* ------------------------------------------------------------------ super admin */

async function superTrends(now: Date): Promise<HomeTrends> {
  const periods = pastMonthEnds(now);
  const first = periods[0]!;
  const last = periods[periods.length - 1]!;

  const [engRows, deleteRows, filingRows, reopenRows] = await Promise.all([
    // Firm-wide on purpose (the caller is a firm-wide admin), deleted rows included: a project
    // deleted this month still counted at the end of last month.
    db
      .select({ id: engagements.id, createdAt: engagements.createdAt, deletedAt: engagements.deletedAt })
      .from(engagements)
      .where(lt(engagements.createdAt, last.end)),
    db
      .select({ engagementId: auditEvents.engagementId, action: auditEvents.action, createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .where(and(inArray(auditEvents.action, ['project.deleted', 'project.restored']), lt(auditEvents.createdAt, last.end))),
    db
      .select(filingColumns)
      .from(complianceInstances)
      .where(
        and(
          gte(complianceInstances.dueDate, new Date(first.end.getTime() - 90 * DAY_MS).toISOString().slice(0, 10)),
          lte(complianceInstances.dueDate, new Date(last.end.getTime() + 31 * DAY_MS).toISOString().slice(0, 10)),
          lt(complianceInstances.createdAt, last.end),
        ),
      ),
    db
      .select({ metadata: auditEvents.metadata, createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .where(and(eq(auditEvents.action, 'compliance.reopened'), gte(auditEvents.createdAt, first.end))),
  ]);

  const events: EngagementDeleteEvent[] = deleteRows
    .filter((r): r is typeof r & { engagementId: string } => Boolean(r.engagementId))
    .map((r) => ({ engagementId: r.engagementId, action: r.action as EngagementDeleteEvent['action'], at: r.createdAt }));
  const reopens = reopensFrom(reopenRows);
  const filings = filingRows as FilingHistoryRow[];

  const liveSets = periods.map((p) => new Set(engRows.filter((r) => engagementLiveAt(r, events, p)).map((r) => r.id)));
  return keep({
    clients: liveSets.map((s) => s.size),
    filingsDue: trailingKnown(periods.map((p, i) => superFilingsDueAsOf(filings, reopens, p, liveSets[i]!))),
  });
}

/* ------------------------------------------------------------------ developer */

async function devTrends(now: Date): Promise<HomeTrends> {
  const periods = pastDays(now);
  const since = new Date(periods[0]!.end.getTime() - DAY_MS);
  const until = periods[periods.length - 1]!.end;

  const [deliveries, emails, ...denied] = await Promise.all([
    db
      .select({ createdAt: notificationDeliveries.createdAt, updatedAt: notificationDeliveries.updatedAt })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.status, 'failed'),
          gte(notificationDeliveries.createdAt, since),
          lt(notificationDeliveries.createdAt, until),
        ),
      ),
    db
      .select({ createdAt: emailSendLog.createdAt, updatedAt: emailSendLog.updatedAt })
      .from(emailSendLog)
      .where(and(eq(emailSendLog.status, 'failed'), gte(emailSendLog.createdAt, since), lt(emailSendLog.createdAt, until))),
    ...periods.map((p) =>
      db
        .select({ n: count() })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.result, 'denied'),
            gte(auditEvents.createdAt, new Date(p.end.getTime() - 7 * DAY_MS)),
            lt(auditEvents.createdAt, p.end),
          ),
        ),
    ),
  ]);

  const failed = [...deliveries, ...emails];
  return keep({
    messagesFailed: periods.map((p) => messagesFailedAsOf(failed, p)),
    denied: denied.map((rows) => Number(rows[0]?.n ?? 0) || 0),
  });
}

/* ------------------------------------------------------------------ client */

async function clientTrends(ctx: AuthContext, engagementId: string | undefined, now: Date): Promise<HomeTrends> {
  if (ctx.role === 'developer') return {};
  let id = engagementId?.trim();
  if (!id) {
    const mine = await getMyEngagement(ctx);
    if (!mine) return {};
    id = mine.id;
  }
  const access = await assertEngagementAccess(ctx, id);
  if (!access.ok) return {};
  const dbId = access.dbId;

  const periods = pastDays(now);
  const first = periods[0]!;
  const last = periods[periods.length - 1]!;
  const [filingRows, reopenRows] = await Promise.all([
    db
      .select(filingColumns)
      .from(complianceInstances)
      .where(
        and(
          eq(complianceInstances.engagementId, dbId),
          gte(complianceInstances.dueDate, `${fyStartOfYmd(first.ymd)}-04-01`),
          lte(complianceInstances.dueDate, addDaysYmd(last.ymd, 15)),
          lt(complianceInstances.createdAt, last.end),
        ),
      ),
    db
      .select({ metadata: auditEvents.metadata, createdAt: auditEvents.createdAt })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.engagementId, dbId),
          eq(auditEvents.action, 'compliance.reopened'),
          gte(auditEvents.createdAt, first.end),
        ),
      ),
  ]);

  const filings = filingRows as FilingHistoryRow[];
  const reopens = reopensFrom(reopenRows);
  return keep({
    dueSoon: trailingKnown(periods.map((p) => clientDueSoonAsOf(filings, reopens, p))),
  });
}
