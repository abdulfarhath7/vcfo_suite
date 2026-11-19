import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { receivableEmailTemplates } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { cleanTemplate, isTemplateKind, type TemplateKind, type TemplateOverride, type TemplateSet } from '@/lib/receivables/templates';
import { scopedSheet } from './shared';

/**
 * A sheet's email templates (the Templates tab, owner 19 Nov 2026). Read and written through
 * `scopedSheet`, so only the sheet's own staff see or change them; the send jobs read them with
 * `systemTemplatesFor`.
 */

type Row = typeof receivableEmailTemplates.$inferSelect;

const toOverride = (r: Row): TemplateOverride => cleanTemplate({ subject: r.subject, greeting: r.greeting, intro: r.intro, closing: r.closing });

async function read(sheetId: string): Promise<TemplateSet> {
  const rows = await db.select().from(receivableEmailTemplates).where(eq(receivableEmailTemplates.sheetId, sheetId));
  const set: TemplateSet = {};
  for (const r of rows) if (isTemplateKind(r.kind)) set[r.kind] = toOverride(r);
  return set;
}

export type TemplateStamp = { updatedAt: string; updatedBy: string | null };

/** Every saved template of the sheet, and when each was last changed. */
export async function listTemplates(ctx: AuthContext, sheetId: string): Promise<{ templates: TemplateSet; stamps: Partial<Record<TemplateKind, TemplateStamp>> }> {
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db.select().from(receivableEmailTemplates).where(eq(receivableEmailTemplates.sheetId, sheet.id));
  const templates: TemplateSet = {};
  const stamps: Partial<Record<TemplateKind, TemplateStamp>> = {};
  for (const r of rows) {
    if (!isTemplateKind(r.kind)) continue;
    templates[r.kind] = toOverride(r);
    stamps[r.kind] = { updatedAt: r.updatedAt.toISOString(), updatedBy: r.updatedBy };
  }
  return { templates, stamps };
}

/** One email type's saved words, for a send the caller makes. */
export async function templateFor(ctx: AuthContext, sheetId: string, kind: TemplateKind): Promise<TemplateOverride | undefined> {
  const sheet = await scopedSheet(ctx, sheetId);
  return (await read(sheet.id))[kind];
}

/** Saves one email type's words; with every part empty the row is removed (the standard words). */
export async function saveTemplate(ctx: AuthContext, sheetId: string, kind: TemplateKind, input: unknown): Promise<TemplateOverride> {
  const sheet = await scopedSheet(ctx, sheetId);
  const t = cleanTemplate(input);
  if (!Object.keys(t).length) {
    await resetTemplate(ctx, sheet.id, kind);
    return {};
  }
  const values = { subject: t.subject ?? null, greeting: t.greeting ?? null, intro: t.intro ?? null, closing: t.closing ?? null, updatedBy: ctx.userId, updatedAt: new Date() };
  await db
    .insert(receivableEmailTemplates)
    .values({ sheetId: sheet.id, kind, ...values })
    .onConflictDoUpdate({ target: [receivableEmailTemplates.sheetId, receivableEmailTemplates.kind], set: values });
  return t;
}

/** Back to the standard words for one email type. */
export async function resetTemplate(ctx: AuthContext, sheetId: string, kind: TemplateKind): Promise<void> {
  const sheet = await scopedSheet(ctx, sheetId);
  await db.delete(receivableEmailTemplates).where(and(eq(receivableEmailTemplates.sheetId, sheet.id), eq(receivableEmailTemplates.kind, kind)));
}

/** SYSTEM: a sheet's saved templates, for the automatic sends. */
export async function systemTemplatesFor(sheetId: string): Promise<TemplateSet> {
  return read(sheetId);
}
