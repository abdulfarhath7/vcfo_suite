import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { listOverdueWaitingFilings } from '@/db/repositories/ask-proactive';
import { lastReminderWithinWindow, resolveReminderTarget } from '@/db/repositories/client-reminders';
import { listDocuments, listVaultRequests } from '@/db/repositories/documents';
import { listCalendarProposals } from '@/db/repositories/reg-proposals';
import { clientRecipients } from '@/lib/actions/shared';
import { askFlags } from '@/lib/ask/config';
import { isAdminOrManager } from '@/lib/auth';
import { todayIST } from '@/lib/compliance/filings';
import { itemKey } from '@/lib/work/item-key';

/**
 * What might be worth proposing tonight, worked out by code from the owner's own reads: no model, so a
 * night with nothing to do costs nothing and a page's text cannot suggest anything. Each one is only a
 * name and an input here; the action's own preview decides whether it stands.
 */
export interface Proposal {
  action: string;
  input: Record<string, unknown>;
  /** What the person should do before accepting, shown on the row. */
  firstLook?: string;
}

const DOCUMENT_WAIT_MS = 2 * 86_400_000;

/** Overdue items the client owes, skipping any reminded in the last 24 hours, whose send would refuse anyway. */
async function overdueReminders(ctx: AuthContext, engagementId: string, now: Date, limit: number): Promise<Proposal[]> {
  const today = todayIST(now);
  const [requests, filings] = await Promise.all([listVaultRequests(ctx, engagementId), listOverdueWaitingFilings(ctx, engagementId, today)]);
  const keys = [
    ...requests.filter((request) => request.status === 'pending' && request.files.length === 0 && request.dueOn && request.dueOn < today).map((request) => itemKey({ kind: 'request', id: request.id })),
    ...filings.map((filing) => itemKey({ kind: 'filing', id: filing.id })),
  ].slice(0, limit);
  if (keys.length === 0 || (await clientRecipients(engagementId)).length === 0) return [];
  const proposals: Proposal[] = [];
  for (const key of keys) {
    const resolved = await resolveReminderTarget(ctx, engagementId, key);
    if (resolved.ok && !(await lastReminderWithinWindow(ctx, resolved.target, now))) proposals.push({ action: 'reminders.sendClient', input: { itemKey: key } });
  }
  return proposals;
}

/** Files sitting on a step for days with nobody's review. The person opens each one before accepting. */
async function documentsWaiting(ctx: AuthContext, engagementId: string, now: Date): Promise<Proposal[]> {
  const documents = await listDocuments(ctx, engagementId);
  return documents
    .filter((document) => document.reviewStatus === 'pending' && document.stepId && !document.replacedAt && Date.parse(document.createdAt) < now.getTime() - DOCUMENT_WAIT_MS)
    .map((document) => ({
      action: 'documents.review',
      input: { documentId: document.id, status: 'approved' },
      firstLook: `Open this file before you accept. It is waiting on ${getItem(document.stepId!)?.title ?? 'its step'}.`,
    }));
}

export async function proposalsForEngagement(ctx: AuthContext, engagementId: string, now: Date, limit: number): Promise<Proposal[]> {
  return [...(await overdueReminders(ctx, engagementId, now, limit)), ...(await documentsWaiting(ctx, engagementId, now))].slice(0, limit);
}

/** Due date changes still waiting on a decision that touch this person's own clients. They sit on no one project. */
export async function firmWideProposals(ctx: AuthContext, limit: number): Promise<Proposal[]> {
  if (!isAdminOrManager(ctx.role) || !askFlags().watch) return [];
  const views = await listCalendarProposals(ctx);
  return views
    .filter((view) => view.status === 'proposed' && view.id && view.clients.length > 0)
    .slice(0, limit)
    .map((view) => ({ action: 'compliance.approveCalendarChange', input: { proposalId: view.id } }));
}
