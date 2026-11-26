'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchViewerAccess } from '@/hooks/use-live-browser';
import type { LiveViewState, StreamClientMessage, StreamServerMessage } from '@/lib/live-browser/contract';
import type { ViewerAccess } from '@/lib/live-browser/types';

/**
 * One viewer's WebSocket to the live browser broker. It asks Suite for a fresh two-minute token
 * each time it connects, paints each JPEG frame straight onto the `<img>` (no React render per
 * frame, nothing kept), keeps the rail's state, and reconnects while the session is open.
 * `watch` is the in-app live mode; `act` is the portal tab, the only view that sends input.
 */

export interface LiveStream {
  imgRef: React.RefObject<HTMLImageElement | null>;
  state: LiveViewState | null;
  viewport: { w: number; h: number };
  connected: boolean;
  hasFrame: boolean;
  ended: string | null;
  error: string | null;
  access: ViewerAccess | null;
  send: (m: StreamClientMessage) => void;
}

const MAX_RETRIES = 8;

export function useLiveStream(sessionId: string | null, role: 'watch' | 'act', enabled = true): LiveStream {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<LiveViewState | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [connected, setConnected] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [ended, setEnded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<ViewerAccess | null>(null);

  useEffect(() => {
    if (!sessionId || !enabled) return;
    let stopped = false;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const connect = async () => {
      let a: ViewerAccess;
      try {
        a = await fetchViewerAccess(sessionId, role);
      } catch (e) {
        const code = (e as { code?: string }).code ?? 'request_failed';
        if (code === 'session_closed') {
          finished = true;
          setEnded('closed');
        } else setError(code);
        return;
      }
      if (stopped) return;
      setAccess(a);
      const ws = new WebSocket(a.streamUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        retries = 0;
        setConnected(true);
        setError(null);
      };
      ws.onmessage = (ev) => {
        let msg: StreamServerMessage;
        try {
          msg = JSON.parse(String(ev.data)) as StreamServerMessage;
        } catch {
          return;
        }
        if (msg.t === 'frame') {
          if (imgRef.current) imgRef.current.src = `data:image/jpeg;base64,${msg.data}`;
          setHasFrame(true);
        } else if (msg.t === 'state') setState(msg.state);
        else if (msg.t === 'hello') setViewport(msg.viewport);
        else if (msg.t === 'end') {
          finished = true;
          setEnded(msg.reason);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        if (stopped || finished) return;
        retries += 1;
        if (retries > MAX_RETRIES) {
          setError('stream_lost');
          return;
        }
        timer = setTimeout(() => void connect(), Math.min(8_000, 500 * 2 ** retries));
      };
    };
    void connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, role, enabled]);

  const send = useCallback((m: StreamClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }, []);

  return { imgRef, state, viewport, connected, hasFrame, ended, error, access, send };
}
