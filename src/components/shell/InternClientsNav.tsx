'use client';

import Link from 'next/link';
import { memo, useMemo, type ComponentType } from 'react';
import { LayoutGroup, m, useReducedMotion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { initialsFromName } from '@/lib/auth';
import { internEngagementPath, isInternEngagementPathname } from '@/lib/project-step-path';
import { fadeOpacity, sidebarPanelStagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Engagement } from '@/data/engagements';
import {
  MotionActivePill,
  SidebarHoverGlass,
  sidebarHoverAttrs,
  type SidebarHoverFollow,
} from '@/components/shell/MotionActivePill';
import {
  SidebarNavDisclosure,
  SidebarNavGroupRail,
  sidebarInactiveOnSkin,
  type SidebarInk,
} from '@/components/shell/SidebarNavGroup';

export const INTERN_CLIENTS_HREF = '/app/intern/clients';

const CLIENT_PILL_CLASS =
  'absolute inset-0 rounded-lg border border-role/20 bg-role-soft/80 shadow-[inset_0_1px_0_oklch(100%_0_0/0.28)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.06)]';
const CLIENT_RAIL_CLASS = 'absolute bottom-1.5 left-0 top-1.5 z-[2] w-[2.5px] rounded-full bg-role';

function isClientsSectionActive(pathname: string) {
  return pathname.startsWith(INTERN_CLIENTS_HREF) || isInternEngagementPathname(pathname);
}

function isEngagementNavActive(pathname: string, engagement: Engagement) {
  const keys = [engagement.slug, engagement.id].filter(Boolean) as string[];
  return keys.some((key) => {
    const base = `/app/intern/engagements/${key}`;
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

function clientSubtitle(engagement: Engagement) {
  const person = engagement.clientDisplayName?.trim();
  if (person && person.toLowerCase() !== engagement.companyName.toLowerCase()) {
    return person;
  }
  return engagement.stage;
}

function useAssignedInternClients() {
  const { engagements, engagementsLoading } = useApp();
  const clients = useMemo(
    () =>
      [...engagements].sort((a, b) =>
        a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }),
      ),
    [engagements],
  );
  return { clients, loading: engagementsLoading };
}

const InternClientRow = memo(function InternClientRow({
  engagement,
  pathname,
  onNavigate,
  ink,
  hoverFollow,
  layoutIdPrefix,
  reduceMotion,
}: {
  engagement: Engagement;
  pathname: string;
  onNavigate?: () => void;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  layoutIdPrefix: string;
  reduceMotion: boolean;
}) {
  const href = internEngagementPath(engagement);
  const active = isEngagementNavActive(pathname, engagement);
  const subtitle = clientSubtitle(engagement);
  const initials = initialsFromName(engagement.companyName) || '•';
  const itemId = `client:${engagement.id}`;
  const followed = Boolean(hoverFollow);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={engagement.companyName}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-[2.35rem] items-center gap-2 rounded-lg py-1 pl-2.5 pr-1.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'font-medium text-role-foreground'
          : sidebarInactiveOnSkin(ink, 'hover:bg-role-soft/45', !followed),
      )}
      {...(hoverFollow ? sidebarHoverAttrs(itemId) : undefined)}
    >
      {hoverFollow ? <SidebarHoverGlass itemId={itemId} follow={hoverFollow} /> : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-client-active`}
          reduced={reduceMotion}
          className={CLIENT_PILL_CLASS}
        />
      ) : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-client-rail`}
          reduced={reduceMotion}
          className={CLIENT_RAIL_CLASS}
        />
      ) : null}
      <span
        aria-hidden
        className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-[9px] font-semibold text-primary-dark"
      >
        {initials}
      </span>
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-inherit">
          {engagement.companyName}
        </span>
        <span
          className={cn(
            'mt-px block truncate font-mono text-[9.5px] uppercase tracking-[0.08em]',
            active
              ? 'text-inherit opacity-80'
              : ink === 'light'
                ? 'text-white/80'
                : 'text-muted-foreground/80',
          )}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
});

function InternClientsViewAll({
  pathname,
  onNavigate,
  ink,
  hoverFollow,
  layoutIdPrefix,
  reduceMotion,
}: {
  pathname: string;
  onNavigate?: () => void;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  layoutIdPrefix: string;
  reduceMotion: boolean;
}) {
  const active = pathname === INTERN_CLIENTS_HREF || pathname.startsWith(`${INTERN_CLIENTS_HREF}/`);
  const itemId = 'client:view-all';
  const followed = Boolean(hoverFollow);

  return (
    <Link
      href={INTERN_CLIENTS_HREF}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative mt-0.5 flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'font-medium text-role-foreground'
          : sidebarInactiveOnSkin(ink, 'hover:bg-role-soft/40', !followed),
      )}
      {...(hoverFollow ? sidebarHoverAttrs(itemId) : undefined)}
    >
      {hoverFollow ? <SidebarHoverGlass itemId={itemId} follow={hoverFollow} /> : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-client-active`}
          reduced={reduceMotion}
          className={CLIENT_PILL_CLASS}
        />
      ) : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-client-rail`}
          reduced={reduceMotion}
          className={CLIENT_RAIL_CLASS}
        />
      ) : null}
      <LayoutGrid className="relative z-10 h-3 w-3 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="relative z-10 truncate">View all</span>
    </Link>
  );
}

function InternClientsPanel({
  pathname,
  onNavigate,
  loading,
  clients,
  showRail,
  ink,
  hoverFollow,
  layoutIdPrefix,
  open,
}: {
  pathname: string;
  onNavigate?: () => void;
  loading: boolean;
  clients: Engagement[];
  showRail: boolean;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  layoutIdPrefix: string;
  open: boolean;
}) {
  const osReduce = Boolean(useReducedMotion());
  const pillsReduced = osReduce || !showRail;

  const body = loading ? (
    <div className="space-y-1 py-0.5" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex min-h-[2.35rem] items-center gap-2 px-1">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2 w-[72%]" />
            <Skeleton className="h-1.5 w-[44%]" />
          </div>
        </div>
      ))}
    </div>
  ) : clients.length === 0 ? (
    <p
      className={cn(
        'px-1 py-1.5 text-[11px] leading-snug',
        ink === 'light' ? 'text-white/85' : 'text-muted-foreground',
      )}
    >
      No clients assigned
    </p>
  ) : (
    <LayoutGroup id={`${layoutIdPrefix}-clients-${showRail ? 'wide' : 'fly'}`}>
      <m.ul
        initial={false}
        animate={open ? 'show' : 'hidden'}
        variants={sidebarPanelStagger}
        className="space-y-0.5"
        aria-label="Assigned clients"
      >
        {clients.map((engagement) => (
          <m.li key={engagement.id} variants={fadeOpacity}>
            <InternClientRow
              engagement={engagement}
              pathname={pathname}
              onNavigate={onNavigate}
              ink={ink}
              hoverFollow={
                hoverFollow?.hoverId === `client:${engagement.id}` ? hoverFollow : undefined
              }
              layoutIdPrefix={layoutIdPrefix}
              reduceMotion={pillsReduced}
            />
          </m.li>
        ))}
      </m.ul>
      <InternClientsViewAll
        pathname={pathname}
        onNavigate={onNavigate}
        ink={ink}
        hoverFollow={hoverFollow?.hoverId === 'client:view-all' ? hoverFollow : undefined}
        layoutIdPrefix={layoutIdPrefix}
        reduceMotion={pillsReduced}
      />
    </LayoutGroup>
  );

  return (
    <div aria-busy={loading || undefined}>
      <SidebarNavGroupRail showRail={showRail} ink={ink}>
        <div className="max-h-52 space-y-0.5 overflow-y-auto overscroll-contain py-0.5 pr-0.5">
          {loading ? <span className="sr-only">Loading clients</span> : null}
          {body}
        </div>
      </SidebarNavGroupRail>
    </div>
  );
}

export function InternClientsNav({
  expanded,
  pathname,
  layoutIdPrefix,
  onNavigate,
  icon: Icon,
  iconTone,
  ink = 'dark',
  hoverFollow,
}: {
  expanded: boolean;
  pathname: string;
  layoutIdPrefix: string;
  onNavigate?: () => void;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
  ink?: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
}) {
  const { clients, loading } = useAssignedInternClients();
  const sectionActive = isClientsSectionActive(pathname);
  const count = loading ? 0 : clients.length;

  return (
    <SidebarNavDisclosure
      id="intern-clients"
      label="Clients"
      icon={Icon}
      iconTone={iconTone}
      badge={count}
      sidebarExpanded={expanded}
      sectionActive={sectionActive}
      layoutIdPrefix={layoutIdPrefix}
      ink={ink}
      hoverFollow={hoverFollow}
      hoverKey="clients"
      ariaLabel={count > 0 ? `Clients, ${count} assigned` : 'Clients'}
      onNavigate={onNavigate}
      flyoutAside={
        count > 0 ? (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{count}</span>
        ) : null
      }
      panel={({ showRail, ink: panelInk, onNavigate: panelNav, hoverFollow: panelHover, open }) => (
        <InternClientsPanel
          pathname={pathname}
          loading={loading}
          clients={clients}
          showRail={showRail}
          ink={panelInk}
          onNavigate={panelNav}
          hoverFollow={panelHover}
          layoutIdPrefix={layoutIdPrefix}
          open={open}
        />
      )}
    />
  );
}
