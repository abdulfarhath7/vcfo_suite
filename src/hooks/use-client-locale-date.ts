'use client';

import { useSyncExternalStore } from 'react';

type DateFormatOptions = Intl.DateTimeFormatOptions;

function formatNow(locale: string, options: DateFormatOptions): string {
  return new Date().toLocaleDateString(locale, options);
}

export function useClientLocaleDate(
  options: DateFormatOptions,
  locale = 'en-IN',
): string {
  return useSyncExternalStore(
    () => () => {},
    () => formatNow(locale, options),
    () => '',
  );
}
