'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { useLiveSession, useStopLiveSession } from '@/hooks/use-live-browser';
import { isAdminOrManager } from '@/lib/auth';
import { LiveRail } from './LiveRail';
import { LiveScreen } from './LiveScreen';
import { useTitleFlash } from './attention';
import { liveTaskNames, shellSegment } from './live-names';
import { useLiveStream } from './use-live-stream';

/**
 * THE PORTAL TAB (`/app/{lead,manager,admin,super}/live-portal/[id]`, MASTER-PLAN.md screen 6):
 * the interactive stream with the same rail. This is where the person types the login, captcha
 * and OTP and clicks Submit and Pay; the agent never does. The person who started the session (or
 * an admin or manager in scope) gets the act view; anyone else on the engagement, or `?view=watch`,
 * gets the watch view. While it is the person's turn, the tab's title and icon flash.
 */
export default function LivePortalView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : null;
  const pathname = usePathname();
  const search = useSearchParams();
  const segment = shellSegment(pathname);
  const { role: appRole, setSidebarCollapsed } = useApp();
  const { data, error, isLoading } = useLiveSession(id);
  const session = data?.session ?? null;
  const owner = Boolean(session && (session.startedBy === data?.me || isAdminOrManager(appRole)));
  const role: 'watch' | 'act' = search?.get('view') === 'watch' || !owner ? 'watch' : 'act';
  const stream = useLiveStream(session?.open ? id : null, role, Boolean(session));
  const stop = useStopLiveSession();
  const { agentName, form } = liveTaskNames(session?.taskId);
  useTitleFlash(role === 'act' && stream.state?.status === 'your_turn', 'Your turn');

  useEffect(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  if (isLoading) return <p className="p-6 text-[13px] text-ink-muted">Opening the live portal…</p>;
  if (error || !session) {
    return (
      <div className="p-6">
        <EmptyState title="This live session is not open to you. It may have ended, or it belongs to a project you are not on." />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-4 lg:flex-row" data-testid="live-portal" data-role={role}>
      <section className="min-w-0 lg:basis-[70%]" aria-label="Live portal">
        {session.open && !stream.ended ? (
          <LiveScreen stream={stream} mode={role} label={agentName} className="w-full" />
        ) : (
          <EmptyState
            title={`This live session has ended. ${session.progressText ?? 'The server browser was closed and nothing from it was kept.'}`}
            action={
              <Link className="text-brand-text underline" href={`/app/${segment}/assist-runs${session.runId ? `?run=${session.runId}` : ''}`}>
                Open the run
              </Link>
            }
          />
        )}
        {role === 'act' && session.open ? (
          <p className="mt-2 text-[12px] text-ink-muted">
            Click the portal and type as you would in your own browser. What you type goes only to the server browser; VCFO Suite never keeps it.
          </p>
        ) : null}
      </section>
      <section className="min-h-0 lg:basis-[30%]">
        <LiveRail stream={stream} session={session} agentName={agentName} form={form} mode={role} segment={segment} onStop={() => stop.mutate(session.id)} />
      </section>
    </div>
  );
}
