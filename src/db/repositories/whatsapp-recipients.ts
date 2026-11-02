import 'server-only';

import { inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listEmailDirectory } from '@/db/repositories/email-directory';
import type { DirectoryPerson, DirectoryProject } from '@/lib/email/directory-filter';
import { maskLast4, whatsappStateOf, type WhatsAppState } from '@/lib/notify/manual-send';
import { isValidE164 } from '@/lib/notify/phone';

/**
 * WHATSAPP RECIPIENTS — who the console's WhatsApp page may message.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Exactly the Email page's directory (`listEmailDirectory`, engagement-scoped
 * by role: a manager's own clients' contacts and team, a lead's assigned
 * clients and their manager, admins firm-wide), plus each person's WhatsApp
 * state. The full number never leaves the server — only the last four digits.
 */

export type WhatsAppPerson = {
  userId: string;
  name: string;
  email: string;
  kind: DirectoryPerson['kind'];
  role: DirectoryPerson['role'];
  projects: DirectoryProject[];
  phoneMasked: string;
  state: WhatsAppState;
};

type PhoneRow = { id: string; phoneE164: string | null; whatsappOptInAt: Date | null; whatsappOptOutAt: Date | null };

/** PURE — joins directory people with their profile's WhatsApp columns (exported for tests). */
export function toWhatsAppPeople(people: DirectoryPerson[], rows: PhoneRow[]): WhatsAppPerson[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return people
    .filter((p) => (p.status ?? 'active') === 'active')
    .map((p) => {
      const r = byId.get(p.userId);
      const phone = r?.phoneE164 ?? null;
      return {
        userId: p.userId,
        name: p.name,
        email: p.email,
        kind: p.kind,
        role: p.role,
        projects: p.projects,
        phoneMasked: maskLast4(phone),
        state: whatsappStateOf({ phoneE164: phone, whatsappOptInAt: r?.whatsappOptInAt ?? null, whatsappOptOutAt: r?.whatsappOptOutAt ?? null }, isValidE164),
      };
    });
}

export async function listWhatsAppRecipients(ctx: AuthContext): Promise<WhatsAppPerson[]> {
  if (ctx.role === 'client') throw new Error('not permitted');
  const people = await listEmailDirectory(ctx);
  const ids = people.map((p) => p.userId).filter(Boolean);
  if (!ids.length) return [];
  const rows = await db
    .select({ id: profiles.id, phoneE164: profiles.phoneE164, whatsappOptInAt: profiles.whatsappOptInAt, whatsappOptOutAt: profiles.whatsappOptOutAt })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return toWhatsAppPeople(people, rows);
}

/** The person, when the caller may message them (same scope as the list); null otherwise. */
export async function getWhatsAppRecipientInScope(ctx: AuthContext, userId: string): Promise<WhatsAppPerson | null> {
  const list = await listWhatsAppRecipients(ctx);
  return list.find((p) => p.userId === userId) ?? null;
}
