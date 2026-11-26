'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLiveSessions, useStartLiveSession, warmLiveBrowser } from '@/hooks/use-live-browser';
import { LIVE_START_ERROR, LIVE_STATUS_LABEL } from '@/lib/live-browser/types';
import { LiveMode } from '@/views/live-portal/LiveMode';
import { LiveScreen } from '@/views/live-portal/LiveScreen';
import { askNotifyPermission } from '@/views/live-portal/attention';
import { useLiveStream } from '@/views/live-portal/use-live-stream';
import type { CardAgentBodyProps } from './types';

/**
 * The body of a browser-route card agent once "Fill now" is pressed (CARD-AGENTS.md, owner
 * changes "one-click start" and "live mode inside the app"). It starts the live session with the
 * fields the user approved on "Before I fill" (G13) and opens live mode in the current page. A
 * session already open for this task is reused, never doubled. When live mode closes, a small live
 * preview stays here; clicking it opens live mode again.
 *
 * The portal login the person uses is asked once and remembered in this browser (a label for the
 * evidence log and the one-session-per-login rule, G14 and G21; never a password).
 */

type Props = CardAgentBodyProps & {
  /** G13: the field keys approved with "Fill now"; omitted means every field "Before I fill" showed as ready. */
  approvedFields?: string[];
};

const loginKey = (portal: string | null) => `vcfo.liveLogin.${portal ?? 'portal'}`;

function readLogin(portal: string | null): string {
  try {
    return window.localStorage.getItem(loginKey(portal)) ?? '';
  } catch {
    return '';
  }
}

function saveLogin(portal: string | null, value: string): void {
  try {
    window.localStorage.setItem(loginKey(portal), value);
  } catch {
    // Private windows: the person types it again next time.
  }
}

export function BrowserFillBody({ engagementId, task, approvedFields, typeOnPortal }: Props) {
  const sessions = useLiveSessions(engagementId, task.taskId);
  const start = useStartLiveSession();
  const [login, setLogin] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const autoStarted = useRef(false);
  const open = sessions.data?.sessions.find((s) => s.open) ?? null;
  const activeId = sessionId ?? open?.id ?? null;

  // A warm browser makes the portal appear in about a second; it is never a session.
  useEffect(() => {
    void warmLiveBrowser();
    setLogin(readLogin(task.pack));
  }, [task.pack]);

  const begin = (label: string) => {
    const value = label.trim();
    if (!value || start.isPending) return;
    saveLogin(task.pack, value);
    askNotifyPermission();
    start.mutate(
      { engagementId, taskId: task.taskId, portalLoginLabel: value, ...(approvedFields ? { approvedKeys: approvedFields } : {}), ...(typeOnPortal?.length ? { typeOnPortal } : {}) },
      {
        onSuccess: (data) => {
          setSessionId(data.session.id);
          setLiveOpen(true);
        },
      },
    );
  };

  // One click: with a remembered login, "Fill now" goes straight on. An open session is reused.
  useEffect(() => {
    if (autoStarted.current || !sessions.isSuccess) return;
    autoStarted.current = true;
    if (open) {
      setSessionId(open.id);
      setLiveOpen(true);
      return;
    }
    const remembered = readLogin(task.pack);
    if (remembered) begin(remembered);
    // Runs once, after the session list first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.isSuccess]);

  const errorCode = (start.error as { code?: string } | null)?.code;

  return (
    <div className="space-y-3" data-testid="browser-fill-body">
      {!activeId ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            begin(login);
          }}
        >
          <label className="block text-[13px] text-ink" htmlFor="live-portal-login">
            Which portal login are you using?
          </label>
          <Input id="live-portal-login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Your user ID or email (never the password)" autoComplete="off" maxLength={120} />
          <Button type="submit" className="w-full" disabled={!login.trim() || start.isPending} data-testid="live-start">
            {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <MonitorPlay aria-hidden />}
            {start.isPending ? 'Opening the portal…' : 'Open the live portal'}
          </Button>
          {errorCode ? <p className="text-[13px] text-danger">{LIVE_START_ERROR[errorCode] ?? 'The live portal could not open.'}</p> : null}
        </form>
      ) : (
        <LivePreview sessionId={activeId} paused={liveOpen} onOpen={() => setLiveOpen(true)} status={open?.status ?? null} progress={open?.progressText ?? null} />
      )}
      {activeId && liveOpen ? <LiveMode sessionId={activeId} onClose={() => setLiveOpen(false)} /> : null}
    </div>
  );
}

/** The small live preview on the card (watch only). It closes its stream while live mode is open. */
function LivePreview({ sessionId, paused, onOpen, status, progress }: { sessionId: string; paused: boolean; onOpen: () => void; status: keyof typeof LIVE_STATUS_LABEL | null; progress: string | null }) {
  const stream = useLiveStream(sessionId, 'watch', !paused);
  const line = stream.state?.line ?? progress ?? 'The live portal is open.';
  return (
    <button type="button" onClick={onOpen} className="group block w-full text-left" data-testid="live-preview" aria-label="Open live mode">
      <div className="pointer-events-none">{paused ? <div className="grid aspect-[16/10] place-items-center rounded-lg border border-line bg-surface-sunken text-[12px] text-ink-muted">Live mode is open</div> : <LiveScreen stream={stream} mode="watch" label="Live preview" />}</div>
      <span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-2">
        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium">{LIVE_STATUS_LABEL[stream.state?.status ?? status ?? 'ready']}</span>
        <span className="truncate text-ink-muted">· {line}</span>
      </span>
    </button>
  );
}
