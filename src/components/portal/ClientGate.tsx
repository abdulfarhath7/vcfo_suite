'use client';

import type { ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { AppShell } from '@/components/shell/AppShell';
import { AuthBootScreen } from '@/components/common/AuthBootScreen';
import { PortalRoot } from './PortalRoot';

/**
 * /app/client/** chrome: a signed-in client gets the one-page client portal
 * (the route page inside only sends an intent); a super admin visiting the
 * client segment keeps the staff AppShell with the route's staff-style view
 * (the portal's data routes are scoped to a client's own engagement).
 */
export function ClientGate({ fontVars, children }: { fontVars: string; children: ReactNode }) {
  const { user, authLoading } = useApp();
  if (authLoading || !user) return <AuthBootScreen />;
  if (user.role === 'client') return <PortalRoot fontVars={fontVars}>{children}</PortalRoot>;
  return <AppShell requireRole="client">{children}</AppShell>;
}
