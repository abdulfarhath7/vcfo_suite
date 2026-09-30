import type { Destination } from '@/data/ask/schema';
import { clientStepHref } from '@/lib/client-overview';
import { adminProjectPath, adminProjectStepPath, staffProjectBase } from '@/lib/project-step-path';
import type { StaffPathBase } from '@/lib/project-step-path';

/** Query params a go-there link adds; the arrival handler strips them. */
export const ASK_FROM_PARAM = 'from';
export const ASK_FROM_VALUE = 'ask';
export const ASK_FOCUS_PARAM = 'focus';

function withArrival(path: string, focus?: string): string {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set(ASK_FROM_PARAM, ASK_FROM_VALUE);
  if (focus) params.set(ASK_FOCUS_PARAM, focus);
  return `${base}?${params.toString()}`;
}

/**
 * URL for a destination, built only through the existing route helpers so
 * staff links follow the caller's own shell (never a hardcoded /app/manager).
 * Super admin has no project / approvals / mail pages of its own and uses the
 * firm admin ones, exactly as `staffProjectBase` already decides.
 */
export function resolveHref(dest: Destination, staffBase: StaffPathBase): string {
  const staff = staffProjectBase(staffBase);
  switch (dest.to) {
    case 'incorporation':
      return withArrival('/app/client/incorporation', dest.focusStepId);
    case 'step':
      return withArrival(clientStepHref(dest.stepId), dest.section ?? dest.stepId);
    case 'inbox':
      // No client Inbox yet (Phase 0): Home carries the next action.
      return withArrival('/app/client/overview', dest.itemId);
    case 'compliances':
      return withArrival('/app/client/compliances/calendar', dest.itemId);
    case 'documents':
      return withArrival('/app/client/documents', dest.docId);
    case 'library':
      return dest.itemId ? `/app/client/library/${encodeURIComponent(dest.itemId)}` : '/app/client/library';
    case 'learn':
      return `/app/client/learn/${encodeURIComponent(dest.slug)}`;
    case 'project':
      return withArrival(adminProjectPath({ slug: dest.engagementId, id: dest.engagementId }, staffBase));
    case 'projectStep':
      return withArrival(
        adminProjectStepPath({ slug: dest.engagementId, id: dest.engagementId }, dest.stepId, staffBase),
        dest.stepId,
      );
    case 'approvals':
      return withArrival(`${staff}/approvals`);
    case 'compliance':
      return withArrival(`${staff}/compliances/filings`, dest.filter);
    case 'composeReminder': {
      const subject = 'Reminder: action needed on your project';
      const body = 'Hello,\n\nA quick reminder that a step on your project is waiting on you. Please complete it in the client portal when you can.\n\nThank you.';
      return `${staff}/mail?${new URLSearchParams({ subject, body })}`;
    }
  }
}

/** The same URL without the arrival params (so a refresh does not re-pulse). */
export function stripAskParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ASK_FROM_PARAM);
  params.delete(ASK_FOCUS_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}
