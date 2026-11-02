'use client';

/**
 * /app/<seat>/ask — the old shell's full-page Ask VCFO. The console answers in its own panel
 * (ConsoleAsk: the same assistant, thread and answer cards), so this address opens that panel
 * and lands on the seat's Today. A project lead sees the panel's "not for project leads" line,
 * as live.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConsole, useCrumbs } from '../../runtime';

export function AskOpen() {
  const { openChat, base, seat } = useConsole();
  const router = useRouter();
  useCrumbs(['Ask VCFO']);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    openChat();
    router.replace(seat === 'lead' ? `${base}/today` : `${base}/dashboard`);
  }, [openChat, router, base, seat]);
  return (
    <section className="glass panel mx-p">
      <div className="sec-load">Opening Ask VCFO…</div>
    </section>
  );
}
