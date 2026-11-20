import 'server-only';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, receivableSheetEditors, receivableSheets } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isValidE164, normalizeToE164 } from '@/lib/notify/phone';
import { RECEIVABLES_STAFF_ROLES } from '@/lib/receivables/roles';
import { SET_PASSWORD_TTL_MS, hashSetPasswordToken } from '../client-team';
import { UUID, conflict, invalid, notFound, scopedSheet } from './shared';

/**
 * RECEIVABLES TEAM (owner, 20 Nov 2026) — the people who run one sheet: its manager and the staff
 * added on the People tab's Team section, each with a role, an email and a WhatsApp number. Each
 * gets the sheet's WhatsApp updates (emails waiting for approval, sent, skipped, failed, payments
 * received) and may approve the waiting emails, unless switched off. A member is a sheet editor
 * (`receivable_sheet_editors`); a new email gets a project-lead login that opens only the sheets it
 * is added to, and a set-password link (one use, seven days). Anyone who can open the sheet may
 * add, change or remove members; the manager is always a member and cannot be removed.
 */

export type TeamMemberDto = {
  userId: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  whatsappUpdates: boolean;
  canApprove: boolean;
  isManager: boolean;
  /** A login made for them that has no password yet. */
  invitePending: boolean;
};

export type TeamInput = { name?: string; role?: string; email?: string; phone?: string | null; whatsappUpdates?: boolean; canApprove?: boolean };

const STAFF = new Set<string>(RECEIVABLES_STAFF_ROLES);
const clean = (v: string | undefined, max: number) => (v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
function phoneOf(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || !raw.trim()) return null;
  const e164 = normalizeToE164(raw);
  if (!e164 || !isValidE164(e164)) throw invalid('phone');
  return e164;
}

/** The manager first, then the members in the order they were added. */
export async function listTeam(ctx: AuthContext, sheetId: string): Promise<TeamMemberDto[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  const editors = await db
    .select({ e: receivableSheetEditors, p: { id: profiles.id, name: profiles.name, email: profiles.email, phone: profiles.phoneE164, passwordHash: profiles.passwordHash } })
    .from(receivableSheetEditors)
    .innerJoin(profiles, eq(profiles.id, receivableSheetEditors.userId))
    .where(eq(receivableSheetEditors.sheetId, sheet.id))
    .orderBy(receivableSheetEditors.createdAt);
  const out: TeamMemberDto[] = [];
  if (sheet.managerUserId) {
    const [m] = await db.select({ id: profiles.id, name: profiles.name, email: profiles.email, phone: profiles.phoneE164 }).from(profiles).where(eq(profiles.id, sheet.managerUserId)).limit(1);
    if (m) out.push({ userId: m.id, name: m.name ?? m.email, email: m.email, role: 'Manager', phone: m.phone ?? null, whatsappUpdates: true, canApprove: true, isManager: true, invitePending: false });
  }
  for (const { e, p } of editors) {
    if (p.id === sheet.managerUserId) continue;
    out.push({ userId: p.id, name: p.name ?? p.email, email: p.email, role: e.role ?? '', phone: p.phone ?? null, whatsappUpdates: e.whatsappUpdates, canApprove: e.canApprove, isManager: false, invitePending: !p.passwordHash });
  }
  return out;
}

export type AddTeamResult = { member: TeamMemberDto; invite: { to: string; name: string; sheetName: string; token: string | null } };

/**
 * Adds a member. An email that is already a staff login is added as it is; a new email gets a
 * project-lead login with no password and a set-password link. A client or partner email is refused.
 */
export async function addTeamMember(ctx: AuthContext, sheetId: string, input: TeamInput): Promise<AddTeamResult> {
  const sheet = await scopedSheet(ctx, sheetId);
  const email = clean(input.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('email');
  const name = clean(input.name, 120) || email.split('@')[0]!;
  const role = clean(input.role, 60);
  const phone = phoneOf(input.phone);
  const [existing] = await db.select({ id: profiles.id, role: profiles.role, status: profiles.status, passwordHash: profiles.passwordHash, phone: profiles.phoneE164 }).from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing && !STAFF.has(existing.role)) throw conflict('email_in_use');
  if (existing && existing.status !== 'active') throw conflict('login_disabled');
  if (existing && existing.id === sheet.managerUserId) throw conflict('already_member');
  let userId: string;
  if (existing) {
    userId = existing.id;
    if (phone && phone !== existing.phone) await db.update(profiles).set({ phoneE164: phone, updatedAt: new Date() }).where(eq(profiles.id, userId));
  } else {
    // A project lead opens only the sheets it is added to; it gets no firm-wide access.
    const [created] = await db
      .insert(profiles)
      .values({ email, name, role: 'intern', internId: `i${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, passwordHash: null, status: 'active', phoneE164: phone })
      .returning({ id: profiles.id });
    userId = created.id;
  }
  const needsPassword = !existing?.passwordHash;
  const token = needsPassword ? randomBytes(32).toString('base64url') : null;
  const tokenCols = token ? { setPasswordTokenHash: hashSetPasswordToken(token), setPasswordExpiresAt: new Date(Date.now() + SET_PASSWORD_TTL_MS) } : {};
  const flags = { role: role || null, whatsappUpdates: input.whatsappUpdates ?? true, canApprove: input.canApprove ?? true, ...tokenCols };
  const inserted = await db
    .insert(receivableSheetEditors)
    .values({ sheetId: sheet.id, userId, addedBy: ctx.userId, ...flags })
    .onConflictDoNothing()
    .returning({ userId: receivableSheetEditors.userId });
  if (!inserted.length) throw conflict('already_member');
  const member = (await listTeam(ctx, sheet.id)).find((m) => m.userId === userId)!;
  return { member, invite: { to: email, name, sheetName: sheet.clientOrgName, token } };
}

/** Changes a member's role, number or switches. The manager's switches stay on. */
export async function updateTeamMember(ctx: AuthContext, sheetId: string, userId: string, input: TeamInput): Promise<TeamMemberDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (!UUID.test(userId ?? '')) throw notFound();
  if (input.phone !== undefined) await db.update(profiles).set({ phoneE164: phoneOf(input.phone), updatedAt: new Date() }).where(eq(profiles.id, userId));
  if (input.name !== undefined && clean(input.name, 120)) await db.update(profiles).set({ name: clean(input.name, 120), updatedAt: new Date() }).where(eq(profiles.id, userId));
  if (userId !== sheet.managerUserId) {
    const set = {
      ...(input.role !== undefined ? { role: clean(input.role, 60) || null } : {}),
      ...(input.whatsappUpdates !== undefined ? { whatsappUpdates: Boolean(input.whatsappUpdates) } : {}),
      ...(input.canApprove !== undefined ? { canApprove: Boolean(input.canApprove) } : {}),
    };
    if (Object.keys(set).length) {
      const rows = await db
        .update(receivableSheetEditors)
        .set(set)
        .where(and(eq(receivableSheetEditors.sheetId, sheet.id), eq(receivableSheetEditors.userId, userId)))
        .returning({ userId: receivableSheetEditors.userId });
      if (!rows.length) throw notFound();
    }
  }
  const m = (await listTeam(ctx, sheet.id)).find((x) => x.userId === userId);
  if (!m) throw notFound();
  return m;
}

/** Takes a member off the sheet; their login stays (it may be on other sheets). */
export async function removeTeamMember(ctx: AuthContext, sheetId: string, userId: string): Promise<void> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (userId === sheet.managerUserId) throw conflict('manager');
  await db.delete(receivableSheetEditors).where(and(eq(receivableSheetEditors.sheetId, sheet.id), eq(receivableSheetEditors.userId, userId)));
}

/** May this person approve the sheet's waiting emails? The manager, admins and members with the switch on. */
export async function mayApprove(ctx: AuthContext, sheetId: string): Promise<boolean> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (sheet.managerUserId === ctx.userId) return true;
  const [row] = await db
    .select({ canApprove: receivableSheetEditors.canApprove })
    .from(receivableSheetEditors)
    .where(and(eq(receivableSheetEditors.sheetId, sheet.id), eq(receivableSheetEditors.userId, ctx.userId)))
    .limit(1);
  // Not a member (a firm-wide admin): allowed, as for every other sheet action.
  return row ? row.canApprove : true;
}

/** SYSTEM: who gets the sheet's WhatsApp updates — every member with the switch on and a valid number. */
export async function systemTeamWhatsApp(sheetId: string): Promise<Array<{ userId: string; name: string; phone: string }>> {
  const [sheet] = await db.select({ managerUserId: receivableSheets.managerUserId }).from(receivableSheets).where(eq(receivableSheets.id, sheetId)).limit(1);
  if (!sheet) return [];
  const editors = await db
    .select({ userId: receivableSheetEditors.userId })
    .from(receivableSheetEditors)
    .where(and(eq(receivableSheetEditors.sheetId, sheetId), eq(receivableSheetEditors.whatsappUpdates, true)));
  const ids = [...new Set([...(sheet.managerUserId ? [sheet.managerUserId] : []), ...editors.map((e) => e.userId)])];
  if (!ids.length) return [];
  const people = await db.select({ id: profiles.id, name: profiles.name, email: profiles.email, phone: profiles.phoneE164, status: profiles.status }).from(profiles).where(inArray(profiles.id, ids));
  return people.filter((p) => p.status === 'active' && p.phone && isValidE164(p.phone)).map((p) => ({ userId: p.id, name: p.name ?? p.email, phone: p.phone! }));
}

/* ---- The set-password link of a member's new login (public, the token is the authority) ---- */

async function editorForToken(token: string) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  const [row] = await db
    .select({ e: receivableSheetEditors, email: profiles.email, sheetName: receivableSheets.clientOrgName })
    .from(receivableSheetEditors)
    .innerJoin(profiles, eq(profiles.id, receivableSheetEditors.userId))
    .innerJoin(receivableSheets, eq(receivableSheets.id, receivableSheetEditors.sheetId))
    .where(eq(receivableSheetEditors.setPasswordTokenHash, hashSetPasswordToken(token)))
    .limit(1);
  if (!row || !row.e.setPasswordExpiresAt || row.e.setPasswordExpiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function systemPeekTeamToken(token: string): Promise<{ email: string; companyName: string } | null> {
  const r = await editorForToken(token);
  return r ? { email: r.email, companyName: r.sheetName } : null;
}

export async function systemSetTeamPassword(token: string, password: string): Promise<{ status: 'ok'; email: string } | { status: 'invalid' | 'too_short' }> {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return { status: 'too_short' };
  const r = await editorForToken(token);
  if (!r) return { status: 'invalid' };
  // Clear the token first, guarded by its hash, so one link cannot win twice.
  const used = await db
    .update(receivableSheetEditors)
    .set({ setPasswordTokenHash: null, setPasswordExpiresAt: null })
    .where(and(eq(receivableSheetEditors.sheetId, r.e.sheetId), eq(receivableSheetEditors.userId, r.e.userId), eq(receivableSheetEditors.setPasswordTokenHash, hashSetPasswordToken(token))))
    .returning({ userId: receivableSheetEditors.userId });
  if (!used.length) return { status: 'invalid' };
  const hash = await bcrypt.hash(password, 10);
  await db.update(profiles).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(profiles.id, r.e.userId));
  return { status: 'ok', email: r.email };
}
