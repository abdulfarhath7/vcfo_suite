import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailTemplates } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  parseEmailBranding,
  plainTextFromHtml,
  wrapComposeBodyHtml,
  type EmailBranding,
  type EmailTemplateDto,
} from '@/lib/email/compose-branding';
import {
  canAccessEmailTemplates,
  canCreateEmailTemplate,
  canMutateEmailTemplate,
} from '@/lib/email/email-template-access';

/**
 * EMAIL TEMPLATES — firm-scoped compose library (SBC branded vs plain).
 *
 * Access (product decision; table had no original RLS):
 *   staff (admin / manager / intern / super_admin): list + read all firm rows
 *   staff: create
 *   admin / manager / super_admin: update / delete any
 *   intern: update / delete own (`created_by = self`)
 *   client: none
 */

type Row = typeof emailTemplates.$inferSelect;

function assertStaff(ctx: AuthContext) {
  if (!canAccessEmailTemplates(ctx.role)) throw new Error('not permitted');
}

function mapRow(row: Row, ctx: AuthContext): EmailTemplateDto {
  const branding = parseEmailBranding(row.branding);
  const bodyText = row.bodyText?.trim() || plainTextFromHtml(row.bodyHtml);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    subject: row.subject,
    bodyText,
    branding,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canMutate: canMutateEmailTemplate(ctx, row.createdBy),
  };
}

export async function listEmailTemplates(ctx: AuthContext): Promise<EmailTemplateDto[]> {
  assertStaff(ctx);
  const rows = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.name));
  return rows.map((row) => mapRow(row, ctx));
}

export async function getEmailTemplate(
  ctx: AuthContext,
  id: string,
): Promise<EmailTemplateDto | null> {
  assertStaff(ctx);
  const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
  return row ? mapRow(row, ctx) : null;
}

export type EmailTemplateWriteInput = {
  name: string;
  description?: string | null;
  subject: string;
  bodyText: string;
  branding: EmailBranding;
  isActive?: boolean;
};

export async function createEmailTemplate(
  ctx: AuthContext,
  input: EmailTemplateWriteInput,
): Promise<EmailTemplateDto> {
  assertStaff(ctx);
  if (!canCreateEmailTemplate(ctx.role)) throw new Error('not permitted');

  const name = input.name.trim();
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();
  if (!name || !subject || !bodyText) throw new Error('invalid_body');

  const [row] = await db
    .insert(emailTemplates)
    .values({
      name,
      description: input.description?.trim() || null,
      subject,
      bodyText,
      bodyHtml: wrapComposeBodyHtml(bodyText, input.branding, subject),
      branding: input.branding,
      fromIdentity: 'firm_default',
      isActive: input.isActive ?? true,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();

  if (!row) throw new Error('create_failed');
  return mapRow(row, ctx);
}

export async function updateEmailTemplate(
  ctx: AuthContext,
  id: string,
  input: EmailTemplateWriteInput,
): Promise<EmailTemplateDto> {
  assertStaff(ctx);
  const existing = await getEmailTemplate(ctx, id);
  if (!existing) throw new Error('not_found');
  if (!existing.canMutate) throw new Error('not permitted');

  const name = input.name.trim();
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();
  if (!name || !subject || !bodyText) throw new Error('invalid_body');

  const [row] = await db
    .update(emailTemplates)
    .set({
      name,
      description: input.description?.trim() || null,
      subject,
      bodyText,
      bodyHtml: wrapComposeBodyHtml(bodyText, input.branding, subject),
      branding: input.branding,
      isActive: input.isActive ?? existing.isActive,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .where(and(eq(emailTemplates.id, id)))
    .returning();

  if (!row) throw new Error('not_found');
  return mapRow(row, ctx);
}

export async function deleteEmailTemplate(ctx: AuthContext, id: string): Promise<void> {
  assertStaff(ctx);
  const existing = await getEmailTemplate(ctx, id);
  if (!existing) throw new Error('not_found');
  if (!existing.canMutate) throw new Error('not permitted');

  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
}
