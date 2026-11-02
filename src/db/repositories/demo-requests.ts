import 'server-only';

import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { demoRequests, firmSettings } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DemoRequest } from '@/lib/growth/demo-request';

/**
 * DEMO REQUESTS — the public "Book a demo" form (G-30).
 *
 * The one allowed exception to "every repository function takes an AuthContext":
 * `insertPublicDemoRequest` runs for anonymous visitors from
 * `app/api/public/demo-request/route.ts`. It may only insert a new row with the fields the
 * form sends; it never reads or changes an existing row, and the route in front of it
 * validates the input with zod, drops honeypot hits and rate-limits by IP.
 *
 * Every read and every other write needs the super admin (`ctx.role === 'super_admin'`; a
 * firm admin does not see the sales inbox), and is refused before the first query.
 */

export type { DemoRequest };

function assertSuper(ctx: AuthContext): void {
  if (ctx.role !== 'super_admin') {
    throw new Error('Only the super admin may read demo requests');
  }
}

function toDemoRequest(r: typeof demoRequests.$inferSelect): DemoRequest {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    company: r.company,
    phone: r.phone,
    message: r.message,
    prospectId: r.prospectId,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Public insert; no AuthContext (see the file comment). Returns the new row's id only. */
export async function insertPublicDemoRequest(input: {
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(demoRequests)
    .values({
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      message: input.message,
    })
    .returning({ id: demoRequests.id });
  if (!row) throw new Error('insert_failed');
  return row;
}

/**
 * System read for the public route: the firm's support email from `firm_settings`, used as
 * the notice address when `DEMO_REQUEST_TO` is not set. Returns null when the row or the
 * address is missing. It reads one column and returns nothing else.
 */
export async function systemFirmSupportEmail(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ supportEmail: firmSettings.supportEmail })
      .from(firmSettings)
      .where(eq(firmSettings.id, 'firm'))
      .limit(1);
    return row?.supportEmail?.trim() || null;
  } catch (err) {
    console.warn('[demo-request] firm settings read failed', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function listDemoRequests(ctx: AuthContext, opts: { limit?: number } = {}): Promise<DemoRequest[]> {
  assertSuper(ctx);
  const rows = await db
    .select()
    .from(demoRequests)
    .orderBy(desc(demoRequests.createdAt))
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 500));
  return rows.map(toDemoRequest);
}

export async function getDemoRequest(ctx: AuthContext, id: string): Promise<DemoRequest | null> {
  assertSuper(ctx);
  const [row] = await db.select().from(demoRequests).where(eq(demoRequests.id, id)).limit(1);
  return row ? toDemoRequest(row) : null;
}

/** Marks a request as turned into a prospect. */
export async function markDemoRequestProspect(ctx: AuthContext, id: string, prospectId: string): Promise<void> {
  assertSuper(ctx);
  await db.update(demoRequests).set({ prospectId }).where(eq(demoRequests.id, id));
}
