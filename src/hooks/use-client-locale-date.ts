'use client';

import { createElement, useSyncExternalStore } from 'react';

type DateFormatOptions = Intl.DateTimeFormatOptions;

const IST = 'Asia/Kolkata';
const DEFAULT_LOCALE = 'en-IN';

function formatNow(locale: string, options: DateFormatOptions): string {
  return new Date().toLocaleDateString(locale, options);
}

function subscribeEverySecond(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

/** `Monday · 17 Aug 2026 · 5:47:32 PM` in en-IN / IST. */
export function formatClientNowLabel(now = new Date(), locale = DEFAULT_LOCALE): string {
  const weekday = now.toLocaleDateString(locale, { weekday: 'long', timeZone: IST });
  const date = now.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  });
  const time = now
    .toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: IST,
    })
    .replace(/\s*(am|pm)/i, (_, period: string) => ` ${period.toUpperCase()}`);
  return `${weekday} · ${date} · ${time}`;
}

export function useClientLocaleDate(
  options: DateFormatOptions,
  locale = DEFAULT_LOCALE,
): string {
  return useSyncExternalStore(
    () => () => {},
    () => formatNow(locale, options),
    () => '',
  );
}

/** Client-only weekday · date · time; ticks every second. Empty on the server. */
export function useClientLocaleNow(locale = DEFAULT_LOCALE): string {
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
