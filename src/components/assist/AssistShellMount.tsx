'use client';

import type { CSSProperties, ReactNode } from 'react';
import { canUseAssist } from '@/lib/assist/access';
import { AssistPanel } from './AssistPanel';
import { useAssistPushPadding } from './use-assist-layout';
import { AssistProvider } from './AssistProvider';

/**
 * Mounts Assist for client, admin and super admin only — gated on the real
 * session role, never the route, because admin and manager share views.
 * Managers and Project Leads get their children untouched.
 */
export function AssistShellMount({ userRole, children }: { userRole: string | null | undefined; children: ReactNode }) {
  if (!canUseAssist(userRole)) return <>{children}</>;
  return (
    <AssistProvider>
      {children}
      <AssistPanel />
    </AssistProvider>
  );
}

/** Content column that makes room for the panel in push mode (≥1440 px). */
export function AssistPushColumn({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const pad = useAssistPushPadding();
  return (
    <div className={className} style={pad ? { ...style, paddingRight: pad } : style}>
      {children}
    </div>
  );
}
