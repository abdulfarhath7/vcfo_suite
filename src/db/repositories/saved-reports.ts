import 'server-only';

import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, savedReports } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  asReportSchedule,
  partnerParams,
  PARTNER_REPORT_KIND,
  type PartnerReportParams,
  type ReportSchedule,
  type SavedReport,
} from '@/lib/reports/partner-report';

/**
 * SAVED REPORTS — a partner report saved with its filters, an email schedule and recipients
 * (G-21).
 *
 * Super admin only, and owner-scoped: a super admin reads and changes only the rows they
 * own (`owner_id = ctx.userId`), so one partner's schedules never appear on another's page.
 * Every change writes an audit event (R-40).
 *
 * The `system*` helpers are for the Inngest function `saved-reports-send` only. They take no
 * AuthContext because a cron run has no session; the job then reads the report data under
 * the owner's own context (`systemReportOwnerContext`), so a scheduled email never shows more
 * than its owner could see on the page.
 */

export type { SavedReport };

function assertSuper(ctx: AuthContext): void {
  if (ctx.role !== 'super_admin') {
    throw new Error('Only the super admin may use saved reports');
  }
}

type Row = typeof savedReports.$inferSelect;

function toSavedReport(r: Row): SavedReport {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    params: partnerParams(r.params),
    schedule: asReportSchedule(r.schedule),
    recipients: r.recipients ?? [],
    lastSentAt: r.lastSentAt ? r.lastSentAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function ownRow(ctx: AuthContext, id: string) {
  return and(eq(savedReports.id, id), eq(savedReports.ownerId, ctx.userId));
}

export async function listSavedReports(ctx: AuthContext): Promise<SavedReport[]> {
  assertSuper(ctx);
  const rows = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.ownerId, ctx.userId))
    .orderBy(desc(savedReports.updatedAt));
  return rows.map(toSavedReport);
}

export async function getSavedReport(ctx: AuthContext, id: string): Promise<SavedReport | null> {
  assertSuper(ctx);
  const [row] = await db.select().from(savedReports).where(ownRow(ctx, id)).limit(1);
  return row ? toSavedReport(row) : null;
}

export interface SavedReportInput {
  name: string;
  params: PartnerReportParams;
  schedule: ReportSchedule;
  recipients: string[];
}

export async function createSavedReport(ctx: AuthContext, input: SavedReportInput): Promise<SavedReport> {
  assertSuper(ctx);
  const [row] = await db
    .insert(savedReports)
    .values({
      ownerId: ctx.userId,
      name: input.name,
      kind: PARTNER_REPORT_KIND,
      params: { ...input.params },
      schedule: input.schedule,
      recipients: input.recipients,
    })
    .returning();
  if (!row) throw new Error('insert_failed');
  await recordAuditEvent(ctx, {
    action: 'saved_report.create',
    summary: `Saved the report ${row.name}${input.schedule === 'none' ? '' : ` (${input.schedule})`}`,
    metadata: { reportId: row.id, schedule: input.schedule, recipients: input.recipients.length },
  });
  return toSavedReport(row);
}

export async function updateSavedReport(
  ctx: AuthContext,
  id: string,
  patch: Partial<SavedReportInput>,
): Promise<SavedReport | null> {
  assertSuper(ctx);
  const set: Partial<typeof savedReports.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.params !== undefined) set.params = { ...patch.params };
  if (patch.schedule !== undefined) set.schedule = patch.schedule;
  if (patch.recipients !== undefined) set.recipients = patch.recipients;
  const [row] = await db.update(savedReports).set(set).where(ownRow(ctx, id)).returning();
  if (!row) return null;
  await recordAuditEvent(ctx, {
    action: 'saved_report.update',
    summary: `Changed the saved report ${row.name}`,
    metadata: {
      reportId: row.id,
      fields: Object.keys(patch).filter((k) => patch[k as keyof SavedReportInput] !== undefined),
    },
  });
  return toSavedReport(row);
}

export async function deleteSavedReport(ctx: AuthContext, id: string): Promise<boolean> {
  assertSuper(ctx);
  const [row] = await db
    .delete(savedReports)
    .where(ownRow(ctx, id))
    .returning({ id: savedReports.id, name: savedReports.name });
  if (!row) return false;
  await recordAuditEvent(ctx, {
    action: 'saved_report.delete',
    summary: `Deleted the saved report ${row.name}`,
    metadata: { reportId: row.id },
  });
  return true;
}

/* ---------- System helpers for the Inngest job (no session) ---------- */

export interface ScheduledReportRow extends SavedReport {
  ownerId: string;
}

/** Every report with a schedule; the job decides which are due (`isReportDue`). */
export async function systemListScheduledReports(): Promise<ScheduledReportRow[]> {
  const rows = await db.select().from(savedReports).where(ne(savedReports.schedule, 'none'));
  return rows.map((r) => ({ ...toSavedReport(r), ownerId: r.ownerId }));
}

export async function systemMarkReportSent(id: string, at: Date): Promise<void> {
  await db.update(savedReports).set({ lastSentAt: at }).where(eq(savedReports.id, id));
}

/**
 * The owner's AuthContext for a scheduled send, or null when the owner is no longer an
 * active super admin (then the report is not sent).
 */
export async function systemReportOwnerContext(ownerId: string): Promise<AuthContext | null> {
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, ownerId))
    .limit(1);
  if (!row || row.role !== 'super_admin' || row.status !== 'active') return null;
  return { userId: row.id, email: row.email, name: row.name?.trim() || row.email, role: 'super_admin' };
}
