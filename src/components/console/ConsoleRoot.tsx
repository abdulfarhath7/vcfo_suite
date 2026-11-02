'use client';

/**
 * STAFF CONSOLE (redesign, Oct 2026) — the root of the manager portal (and, in
 * turn, admin, super admin and developer): a port of the owner's prototype
 * "Graphite console" (sbc-vcfo-local/source/portal/v4: mgr_body.txt,
 * a59n…a59y, css_mgr.txt). Every prototype rule is scoped under `.cpx`
 * (scripts/portal-css.mjs); the root carries the prototype's body classes:
 * `gx` (Graphite), `data-seat` (accent per seat) and `data-role`.
 *
 * Pages are real Next routes rendered inside <Frame>; see README.md.
 */
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { AskProvider } from '@/components/ask/AskProvider';
import { AuthBootScreen } from '@/components/common/AuthBootScreen';
import { SPRITE_SVG } from '@/components/portal/sprite';
import { useBodyTheme } from '@/components/portal/use-body-theme';
import { ConsoleProvider, useConsole, type Seat } from './runtime';
import { Frame } from './Frame';
import { DrawerHost, ModalHost, PopHost, SearchBridge, ToastView } from './overlays';
import { ConsoleAsk } from './ConsoleAsk';
import { SEAT_BADGES } from './seats/badges';
import './console-css';

/** Which signed-in roles may open a seat (super admin may enter every workspace, as today). */
const SEAT_ROLES: Record<Seat, string[]> = {
  mgr: ['manager', 'super_admin'],
  lead: ['intern', 'super_admin'],
  adm: ['admin', 'super_admin'],
  sup: ['super_admin'],
  dev: ['super_admin'],
};

export function ConsoleGate({ seat, fontVars, children }: { seat: Seat; fontVars: string; children: ReactNode }) {
  const { user, authLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (authLoading || user) return;
    const next = pathname?.startsWith('/app') ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [authLoading, user, pathname, router]);
  if (authLoading || !user) return <AuthBootScreen />;
  if (!SEAT_ROLES[seat].includes(user.role)) return <AuthBootScreen label="Opening your workspace…" />;
  return (
    <AskProvider>
      <ConsoleProvider seat={seat}>
        <Root fontVars={fontVars}>{children}</Root>
      </ConsoleProvider>
    </AskProvider>
  );
}

function Root({ fontVars, children }: { fontVars: string; children: ReactNode }) {
  const { seat, theme } = useConsole();
  useBodyTheme(theme);
  const Badges = SEAT_BADGES[seat];
  return (
    <div className={`cpx gx ${fontVars}`} data-theme={theme} data-seat={seat} data-role={seat}>
      <div aria-hidden="true" style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: SPRITE_SVG }} />
      {Badges ? <Badges /> : null}
      <Frame>{children}</Frame>
      <ConsoleAsk />
      <PopHost />
      <DrawerHost />
      <ModalHost />
      <SearchBridge />
      <ToastView />
    </div>
  );
}
