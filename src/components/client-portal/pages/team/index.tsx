'use client';

/**
 * Team-area page entries. A signed-in client inside the v7 portal gets the new
 * page; anyone else on /app/client/** (a super admin in the staff AppShell)
 * keeps the existing view passed as `legacy`.
 */
import { useEffect, type ReactNode } from 'react';
import { usePortalOptional } from '../../PortalProvider';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { TeamPage } from './TeamPage';
import { AnnouncementsPage } from './AnnouncementsPage';
import { NotificationsPage } from './NotificationsPage';
import { AuditPage } from './AuditPage';
import { SettingsPage } from './SettingsPage';

function Area({ page, legacy }: { page: ReactNode; legacy: ReactNode }) {
  const portal = usePortalOptional();
  const { prefs } = useShellAppearance();
  useEffect(() => {
    if (!portal) return;
    // app preference overrides; off → back to the OS setting the shell applies
    const os = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('.cp')?.setAttribute('data-reduce-motion', prefs.reduceMotion || os ? 'true' : 'false');
  }, [portal, prefs.reduceMotion]);
  return <>{portal ? page : legacy}</>;
}

export function ClientTeamEntry({ legacy }: { legacy: ReactNode }) {
  return <Area page={<TeamPage />} legacy={legacy} />;
}
export function ClientAnnouncementsEntry({ legacy }: { legacy: ReactNode }) {
  return <Area page={<AnnouncementsPage />} legacy={legacy} />;
}
export function ClientNotificationsEntry({ legacy }: { legacy: ReactNode }) {
  return <Area page={<NotificationsPage />} legacy={legacy} />;
}
export function ClientAuditEntry({ legacy }: { legacy: ReactNode }) {
  return <Area page={<AuditPage />} legacy={legacy} />;
}
export function ClientSettingsEntry({ legacy }: { legacy: ReactNode }) {
  return <Area page={<SettingsPage />} legacy={legacy} />;
}
