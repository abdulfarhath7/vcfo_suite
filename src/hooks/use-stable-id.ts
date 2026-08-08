'use client';

import { useId } from 'react';

/** Stable id for SSR/client — prefer React `useId()` over mount effects. */
export function useStableId(prefix = 'uid'): string {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, '')}`;
}
