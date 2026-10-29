'use client';

import { sep } from '@/lib/date-format';
import { createElement, useSyncExternalStore } from 'react';

const IST = 'Asia/Kolkata';
const DEFAULT_LOCALE = 'en-IN';

function subscribeEverySecond(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

/** `Wed 29 Oct 2026 · 12:31 PM` in IST, the prototype's greeting card date (R-17). */
export function formatClientNowLabel(now = new Date(), locale = DEFAULT_LOCALE): string {
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'short', timeZone: IST });
  const date = sep(now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }));
  const time = now
    .toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST })
    .replace(/\s*(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
  return `${weekday} ${date} · ${time}`;
}

/** Client-only short weekday, date and 12-hour time; checks every second. Empty on the server. */
function useClientLocaleNow(locale = DEFAULT_LOCALE): string {
  return useSyncExternalStore(
    subscribeEverySecond,
    () => formatClientNowLabel(new Date(), locale),
    () => '',
  );
}

/** Leaf clock so a 1s tick cannot re-render the surrounding page. */
export function ClientLocaleNowLabel({
  className,
  locale = DEFAULT_LOCALE,
}: {
  className?: string;
  locale?: string;
}) {
  const label = useClientLocaleNow(locale);
  return createElement('span', { className }, label || 'Today');
}
