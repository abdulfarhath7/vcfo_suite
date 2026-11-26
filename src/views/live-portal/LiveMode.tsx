'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useLiveSession, useStopLiveSession } from '@/hooks/use-live-browser';
import { LiveRail } from './LiveRail';
import { LiveScreen } from './LiveScreen';
import { openPortalTab } from './attention';
import { livePortalHref, liveTaskNames, shellSegment } from './live-names';
import { useLiveStream } from './use-live-stream';
import { useYourTurnSignal } from './use-your-turn';

/**
 * LIVE MODE inside the current page (MASTER-PLAN.md screen 5): the sidebar folds, the portal
 * stream takes about 70% of the width (watch only, so a stray click cannot disturb the fill) and
 * the agent rail the rest. At a human step the rail says "Your turn" with "Go to portal tab"; the
 * portal tab (`/app/<role>/live-portal/<id>`) is the only view that takes keys and clicks.
 * Closing live mode leaves the session running; the card keeps a small live preview.
 */
export function LiveMode({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const pathname = usePathname();
  const segment = shellSegment(pathname);
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { data } = useLiveSession(sessionId);
  const session = data?.session ?? null;
  const stream = useLiveStream(sessionId, 'watch');
  const stop = useStopLiveSession();
  const { agentName, form } = liveTaskNames(session?.taskId);
  useYourTurnSignal(stream.state, agentName);

  // Fold the sidebar while live mode is open; put it back as it was.
  useEffect(() => {
    const before = sidebarCollapsed;
    setSidebarCollapsed(true);
    return () => setSidebarCollapsed(before);
    // Only on open and close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const portalHref = livePortalHref(segment, sessionId);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface md:left-14" role="dialog" aria-modal="true" aria-label={`Live mode: ${agentName}`} data-testid="live-mode">
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <section className="min-w-0 lg:basis-[70%]" aria-label="Live portal">
          <LiveScreen stream={stream} mode="watch" label={agentName} className="w-full" />
          {stream.ended ? <p className="mt-2 text-[13px] text-ink-muted">This live session has ended.</p> : null}
          {stream.error ? <p className="mt-2 text-[13px] text-danger">The stream could not open ({stream.error}).</p> : null}
        </section>
        <section className="min-h-0 lg:basis-[30%]">
          <LiveRail
            stream={stream}
            session={session}
            agentName={agentName}
            form={form}
            mode="watch"
            segment={segment}
            onGoToPortal={() => openPortalTab(portalHref, sessionId)}
            onPopOut={() => openPortalTab(portalHref, sessionId)}
            onStop={() => stop.mutate(sessionId)}
            onClose={onClose}
          />
        </section>
      </div>
    </div>
  );
}
