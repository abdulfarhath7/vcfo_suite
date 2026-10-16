'use client';

import type { ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { AppShell } from '@/components/shell/AppShell';
import { AuthBootScreen } from '@/components/common/AuthBootScreen';
import { ClientPortalShell } from './ClientPortalShell';

/**
 * /app/client/** chrome: a signed-in client gets the v7 client portal; a super
 * admin visiting the client shell keeps the staff-style AppShell (the portal's
 * data routes are scoped to the client's own engagement).
 */
export function ClientPortalGate({ children }: { children: ReactNode }) {
  const { user, authLoading } = useApp();
  if (authLoading || !user) return <AuthBootScreen />;
  if (user.role === 'client') return <ClientPortalShell>{children}</ClientPortalShell>;
  return <AppShell requireRole="client">{children}</AppShell>;
}
