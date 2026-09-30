'use client';

import { Suspense } from 'react';
import { useAskFocus } from '@/hooks/ask/useAskFocus';

function Handler() {
  useAskFocus();
  return null;
}

/** Arrival handler for go-there links; Suspense because it reads search params. */
export function AskFocusHandler() {
  return (
    <Suspense fallback={null}>
      <Handler />
    </Suspense>
  );
}
