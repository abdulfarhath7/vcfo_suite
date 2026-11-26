import { agentNameOf, findSubAgent } from '@/lib/assist-agents/catalog';

/** The robot's name and form for a catalog task id, for the rail's header. */
export function liveTaskNames(taskId: string | null | undefined): { agentName: string; form: string } {
  const task = taskId ? findSubAgent(taskId) : undefined;
  return { agentName: task ? agentNameOf(task) : 'Portal agent', form: task?.form ?? '' };
}

/** The shell segment of the current path (`lead`, `manager`, `admin` or `super`); `lead` by default. */
export function shellSegment(pathname: string | null | undefined): string {
  return /^\/app\/(lead|manager|admin|super)\//.exec(pathname ?? '')?.[1] ?? 'lead';
}

export const livePortalHref = (segment: string, sessionId: string, view?: 'watch') => `/app/${segment}/live-portal/${sessionId}${view ? '?view=watch' : ''}`;
