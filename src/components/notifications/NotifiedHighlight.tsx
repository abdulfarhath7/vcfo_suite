'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { NOT_PERMITTED_HASH, NOTIFIED_HASH } from '@/lib/projects/project-step-path';

/** How long the card a notification points at stays highlighted (GL-01). */
export const NOTIFIED_HIGHLIGHT_MS = 2000;

/**
 * GL-01: a page opened from a notification's "Open" button carries `#notified`. This moves the
 * page to the card the notification is about (`data-notified-target`, else the page's main
 * area) and highlights it for two seconds, then takes the hash off the address so a reload or
 * a copied link does not flash again. A page opened with `#not-permitted` instead says why the
 * step did not open. Mounted once for the whole app.
 */
export function NotifiedHighlight() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // GL-01: a step the person may not open sends them here, to the nearest page they may open.
    if (window.location.hash === NOT_PERMITTED_HASH) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      toast.error('You cannot open that step: the project is not shared with you, or it was removed. This is the nearest page you can open.', {
        id: 'not-permitted',
        duration: 6000,
      });
      return;
    }
    if (window.location.hash !== NOTIFIED_HASH) return;
    let off: number | undefined;
    let tries = 0;
    // The step page loads its data after the route change, so the card can arrive a moment later.
    const find = window.setInterval(() => {
      const target =
        document.querySelector<HTMLElement>('[data-notified-target]') ?? (tries >= 10 ? document.querySelector<HTMLElement>('main') : null);
      tries += 1;
      if (!target && tries < 40) return;
      window.clearInterval(find);
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      if (!target) return;
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      target.classList.add('notified-flash');
      off = window.setTimeout(() => target.classList.remove('notified-flash'), NOTIFIED_HIGHLIGHT_MS);
    }, 100);
    return () => {
      window.clearInterval(find);
      if (off) window.clearTimeout(off);
    };
  }, [pathname]);
  return null;
}
