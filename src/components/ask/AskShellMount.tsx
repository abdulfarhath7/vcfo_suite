'use client';

import type { CSSProperties, ReactNode } from 'react';
import { canUseAsk } from '@/lib/ask/access';
import { AskPanel } from './AskPanel';
import { useAskPushPadding } from './use-ask-layout';
import { AskProvider } from './AskProvider';

/**
 * Mounts Ask VCFO for client, admin and super admin only — gated on the real
 * session role, never the route, because admin and manager share views.
 * Managers and Project Leads get their children untouched.
 */
export function AskShellMount({ userRole, children }: { userRole: string | null | undefined; children: ReactNode }) {
  if (!canUseAsk(userRole)) return <>{children}</>;
  return (
    <AskProvider>
      {children}
      <AskPanel />
    </AskProvider>
  );
}

/** Content column that makes room for the panel in push mode (≥1440 px). */
export function AskPushColumn({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const pad = useAskPushPadding();
  return (
    <div className={className} style={pad ? { ...style, paddingRight: pad } : style}>
      {children}
    </div>
  );
}
