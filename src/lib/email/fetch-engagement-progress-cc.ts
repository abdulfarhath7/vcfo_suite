import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getEngagementById } from '@/db/repositories/engagements';
import { engagementDbId } from '@/lib/legacy-engagement-ids';

function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) => {
    if (typeof e !== 'string') return [];
    const trimmed = e.trim().toLowerCase();
    return trimmed ? [trimmed] : [];
  });
}

/**
 * Read engagement-specific progress CC addresses.
 * Callers should already be authorized (manager) for the engagement.
 */
export async function fetchEngagementProgressCcEmails(
  ctx: AuthContext,
  appOrDbEngagementId: string,
): Promise<string[]> {
  const row = await getEngagementById(ctx, engagementDbId(appOrDbEngagementId));
  if (!row) return [];
  return normalizeEmails(row.progressCcEmails);
}
