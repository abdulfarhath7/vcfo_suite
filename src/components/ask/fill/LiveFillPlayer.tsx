'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { resolveHref, stripAskParams } from '@/lib/ask/resolve-href';
import { useAskLinkBase } from '../use-ask-link-base';
import { useAskOptional } from '../ask-context';
import { FILL_START_EVENT, type FillStartDetail } from './fill-mode';
import { clearFillState, setFillActions, fillActions } from './fill-store';
import { FillRunner } from './fill-runner';
import { GhostCursor } from './GhostCursor';

/**
 * Ask VCFO "Fill into app" in the browser. Mounted once in the shell (it survives route
 * changes), it listens for `vcfo:ask-fill-start` from the review card or a chat answer and runs
 * the fill: Manual opens each step page and types it live, Auto shows the server's progress.
 * Staff only; a client shell never starts a fill.
 */
export function LiveFillPlayer() {
  const ask = useAskOptional();
  const router = useRouter();
  const base = useAskLinkBase();
  const staff = Boolean(ask?.shell) && ask?.shell !== 'client';
  const navRef = useRef({ router, base });
  useEffect(() => {
    navRef.current = { router, base };
  });
  const runnerRef = useRef<FillRunner | null>(null);

  useEffect(() => {
    if (!staff) return;
    const onStart = (event: Event) => {
      const detail = (event as CustomEvent<FillStartDetail>).detail;
      if (!detail?.runId) return;
      runnerRef.current?.cancel();
      const runner = new FillRunner(detail.runId, detail.mode === 'auto' ? 'auto' : 'manual', {
        navigate: (engagementId, stepId) => {
          const { router: r, base: b } = navRef.current;
          // The role-correct step URL, without the arrival params (the player does its own focus).
          const [path, query = ''] = resolveHref({ to: 'projectStep', engagementId, stepId }, b).split('?');
          r.push(`${path}${stripAskParams(`?${query}`)}`);
        },
      });
      runnerRef.current = runner;
      ask?.setOpen(true);
      void runner.start().then(() => {
        if (runnerRef.current !== runner) return;
        // Finished: the rail stays until dismissed.
        setFillActions({ ...fillActions(), dismiss: () => clearFillState() });
      });
    };
    window.addEventListener(FILL_START_EVENT, onStart);
    return () => window.removeEventListener(FILL_START_EVENT, onStart);
    // `ask.setOpen` is stable; the listener must not re-subscribe on every chat update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  useEffect(
    () => () => {
      runnerRef.current?.cancel();
      runnerRef.current = null;
    },
    [],
  );

  return staff ? <GhostCursor /> : null;
}
