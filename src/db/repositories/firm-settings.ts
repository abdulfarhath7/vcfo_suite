import 'server-only';

import { desc, eq, like } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents, firmSettings, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  describeChange,
  diffFirmSettings,
  FIRM_SETTINGS_DEFAULTS,
  normalizePatch,
  readRolePermissions,
  readServiceTargets,
  type RolePermissions,
  type FirmSettings,
  type FirmSettingsChange,
  type FirmSettingsPatch,
} from '@/lib/firm-settings/firm-settings';

/**
 * FIRM SETTINGS REPOSITORY (G-02) — the one-row `firm_settings` table.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   read  — every staff role (super admin, admin, manager, project lead). Clients and the
 *           developer role are refused before any query.
 *   write — firm-wide admins only (`isFirmWideAdmin`: super admin and admin). Role
 *           permissions (P-236) are the super admin's alone, so an admin cannot widen
 *           their own role.
 *   history — firm-wide admins only; it reads the `firm_settings.*` audit rows, which are
 *           firm-wide rows that `audit_events` already shows admins in full.
 *
 * Every change writes one audit event per field with the old and the new value (R-40).
 */

const ROW_ID = 'firm';
const STAFF_READ_ROLES = new Set(['super_admin', 'admin', 'manager', 'intern']);

export class FirmSettingsForbiddenError extends Error {
  constructor(message = 'Not permitted to change firm settings') {
    super(message);
    this.name = 'FirmSettingsForbiddenError';
  }
}

function assertCanRead(ctx: AuthContext): void {
  if (!STAFF_READ_ROLES.has(ctx.role)) {
    throw new FirmSettingsForbiddenError('Only staff may read firm settings');
  }
}

function assertCanWrite(ctx: AuthContext): void {
  if (!isFirmWideAdmin(ctx.role)) throw new FirmSettingsForbiddenError();
}

type Row = typeof firmSettings.$inferSelect;

function toSettings(row: Row | undefined, updatedByName: string | null): FirmSettings {
  if (!row) return { ...FIRM_SETTINGS_DEFAULTS };
  return {
    firmName: row.firmName ?? null,
    hasLogo: Boolean(row.logoObjectKey),
    workingDays: Array.isArray(row.workingDays) ? row.workingDays : FIRM_SETTINGS_DEFAULTS.workingDays,
    holidays: Array.isArray(row.holidays) ? row.holidays : [],
    reminderDays: Array.isArray(row.reminderDays) ? row.reminderDays : FIRM_SETTINGS_DEFAULTS.reminderDays,
    timezone: row.timezone || FIRM_SETTINGS_DEFAULTS.timezone,
    supportEmail: row.supportEmail ?? null,
    supportPhone: row.supportPhone ?? null,
    address: row.address ?? null,
    serviceTargets: readServiceTargets(row.serviceTargets),
    rolePermissions: readRolePermissions(row.rolePermissions),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    updatedByName,
  };
}

async function loadRow(): Promise<{ row: Row | undefined; updatedByName: string | null }> {
  const [hit] = await db
    .select({ row: firmSettings, updatedByName: profiles.name, updatedByEmail: profiles.email })
    .from(firmSettings)
    .leftJoin(profiles, eq(profiles.id, firmSettings.updatedBy))
    .where(eq(firmSettings.id, ROW_ID))
    .limit(1);
  return {
    row: hit?.row,
    updatedByName: hit ? (hit.updatedByName?.trim() || hit.updatedByEmail || null) : null,
  };
}

/** Any staff role: the firm's settings, or the defaults while nobody has saved any. */
export async function getFirmSettings(ctx: AuthContext): Promise<FirmSettings> {
  assertCanRead(ctx);
  const { row, updatedByName } = await loadRow();
  return toSettings(row, updatedByName);
}

/**
 * Admin and super admin: change some fields. Only fields whose value differs are written, and
 * each one gets its own audit event. Returns the saved settings and the change list.
 */
export async function updateFirmSettings(
  ctx: AuthContext,
  patch: FirmSettingsPatch,
): Promise<{ settings: FirmSettings; changes: FirmSettingsChange[] }> {
  assertCanWrite(ctx);
  if (patch.rolePermissions !== undefined && ctx.role !== 'super_admin') {
    throw new FirmSettingsForbiddenError('Only the super admin may change role permissions');
  }
  const { row, updatedByName } = await loadRow();
  const before = toSettings(row, updatedByName);
  const changes = diffFirmSettings(before, patch);
  if (changes.length === 0) return { settings: before, changes };

  const next = normalizePatch(patch);
  const values: Partial<typeof firmSettings.$inferInsert> = {};
  for (const change of changes) {
    (values as Record<string, unknown>)[change.field] = next[change.field];
  }
  const now = new Date();
  await db
    .insert(firmSettings)
    .values({ id: ROW_ID, ...values, updatedBy: ctx.userId, updatedAt: now })
    .onConflictDoUpdate({
      target: firmSettings.id,
      set: { ...values, updatedBy: ctx.userId, updatedAt: now },
    });

  for (const change of changes) {
    await recordAuditEvent(ctx, {
      action: `firm_settings.${change.field}`,
      summary: describeChange(change),
      metadata: { field: change.field, old: change.old, new: change.new },
    });
  }

  return {
    settings: {
      ...before,
      ...next,
      serviceTargets: next.serviceTargets ? readServiceTargets(next.serviceTargets) : before.serviceTargets,
      rolePermissions: next.rolePermissions ? readRolePermissions(next.rolePermissions) : before.rolePermissions,
      updatedAt: now.toISOString(),
      updatedByName: ctx.name,
    },
    changes,
  };
}

/** Any staff role: the S3 key of the logo, or null. Only the logo route reads it. */
export async function getFirmLogoKey(ctx: AuthContext): Promise<string | null> {
  assertCanRead(ctx);
  const [hit] = await db
    .select({ key: firmSettings.logoObjectKey })
    .from(firmSettings)
    .where(eq(firmSettings.id, ROW_ID))
    .limit(1);
  return hit?.key ?? null;
}

/**
 * Admin and super admin: point the settings at a new logo object (or none). Returns the key it
 * replaced, so the route can delete the old object after the row is saved.
 */
export async function setFirmLogoKey(
  ctx: AuthContext,
  key: string | null,
): Promise<{ previousKey: string | null }> {
  assertCanWrite(ctx);
  const [hit] = await db
    .select({ key: firmSettings.logoObjectKey })
    .from(firmSettings)
    .where(eq(firmSettings.id, ROW_ID))
    .limit(1);
  const previousKey = hit?.key ?? null;
  const now = new Date();
  await db
    .insert(firmSettings)
    .values({ id: ROW_ID, logoObjectKey: key, updatedBy: ctx.userId, updatedAt: now })
    .onConflictDoUpdate({
      target: firmSettings.id,
      set: { logoObjectKey: key, updatedBy: ctx.userId, updatedAt: now },
    });
  await recordAuditEvent(ctx, {
    action: 'firm_settings.logo',
    summary: describeChange({ field: 'logo', new: key }),
    metadata: { field: 'logo', old: previousKey, new: key },
  });
  return { previousKey };
}

export interface FirmSettingsHistoryRow {
  id: string;
  at: string;
  who: string | null;
  summary: string;
}

/** Admin and super admin: the latest settings changes, newest first. Others get none. */
export async function listFirmSettingsHistory(
  ctx: AuthContext,
  limit = 20,
): Promise<FirmSettingsHistoryRow[]> {
  if (!isFirmWideAdmin(ctx.role)) return [];
  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      actorName: auditEvents.actorName,
      actorEmail: auditEvents.actorEmail,
      summary: auditEvents.summary,
    })
    .from(auditEvents)
    .where(like(auditEvents.action, 'firm_settings.%'))
    .orderBy(desc(auditEvents.createdAt))
    .limit(Math.max(1, Math.min(limit, 100)));
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    who: r.actorName?.trim() || r.actorEmail || null,
    summary: r.summary,
  }));
}

/**
 * The firm's default reminder days (days before a due date), for the reminder paths that run
 * for any signed-in person, clients included. No role check: it returns only these numbers.
 * Null when the firm never saved settings, so callers keep their own default.
 */
export async function systemGetReminderDays(): Promise<number[] | null> {
  const [row] = await db
    .select({ reminderDays: firmSettings.reminderDays })
    .from(firmSettings)
    .where(eq(firmSettings.id, 'firm'))
    .limit(1);
  const days = (row?.reminderDays ?? []).filter((d) => Number.isInteger(d) && d >= 0);
  return days.length > 0 ? days : null;
}

/**
 * The firm's role permissions (P-236) for a server check such as "may this role approve".
 * No role check: it returns only the permission grid, never firm details. The defaults apply
 * while nobody has saved a grid.
 */
export async function systemGetRolePermissions(): Promise<RolePermissions> {
  const [row] = await db
    .select({ rolePermissions: firmSettings.rolePermissions })
    .from(firmSettings)
    .where(eq(firmSettings.id, ROW_ID))
    .limit(1);
  return readRolePermissions(row?.rolePermissions);
}
