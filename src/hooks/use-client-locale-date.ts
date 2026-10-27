'use client';

import { sep, time24 } from '@/lib/date-format';
import { createElement, useSyncExternalStore } from 'react';

const IST = 'Asia/Kolkata';
const DEFAULT_LOCALE = 'en-IN';

function subscribeEverySecond(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

/** `Monday · 17 Aug 2026 · 17:47` in en-IN / IST. */
function formatClientNowLabel(now = new Date(), locale = DEFAULT_LOCALE): string {
  const weekday = sep(now.toLocaleDateString(locale, { weekday: 'long', timeZone: IST }));
  const date = sep(now.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }));
  /* 24-hour clock without seconds (K-13, rule R-29): "17:47". */
  const time = time24(now, IST);
  return `${weekday} · ${date} · ${time}`;
}

/** Client-only weekday · date · time; ticks every second. Empty on the server. */
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
