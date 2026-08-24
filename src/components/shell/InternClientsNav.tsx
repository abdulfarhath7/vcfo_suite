'use client';

import Link from 'next/link';
import { useMemo, type ComponentType } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { initialsFromName } from '@/lib/auth';
import { internEngagementPath, isInternEngagementPathname } from '@/lib/project-step-path';
import { fadeUp, fadeUpReduced, staggerKids } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Engagement } from '@/data/engagements';
import {
  SidebarHoverGlass,
  sidebarHoverHandlers,
  type SidebarHoverFollow,
} from '@/components/shell/MotionActivePill';
import {
  SidebarNavDisclosure,
  SidebarNavGroupRail,
  sidebarInactiveOnSkin,
  type SidebarInk,
} from '@/components/shell/SidebarNavGroup';

export const INTERN_CLIENTS_HREF = '/app/intern/clients';

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

function InternClientRow({
  engagement,
  pathname,
  onNavigate,
  ink,
  hoverFollow,
}: {
  engagement: Engagement;
  pathname: string;
  onNavigate?: () => void;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
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
          ? 'bg-role-soft/80 text-role-foreground'
          : sidebarInactiveOnSkin(ink, 'hover:bg-role-soft/45', !followed),
      )}
      {...(hoverFollow ? sidebarHoverHandlers(hoverFollow, itemId) : undefined)}
    >
      {hoverFollow ? <SidebarHoverGlass itemId={itemId} follow={hoverFollow} /> : null}
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 z-[2] h-3.5 w-[2.5px] -translate-y-1/2 rounded-full bg-role"
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
}

function InternClientsPanel({
  pathname,
  onNavigate,
  loading,
  clients,
  showRail,
  ink,
  hoverFollow,
}: {
  pathname: string;
  onNavigate?: () => void;
  loading: boolean;
  clients: Engagement[];
  showRail: boolean;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
}) {
  const reduceMotion = useReducedMotion();
  const itemVariants = reduceMotion ? fadeUpReduced : fadeUp;

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
    <m.ul
      initial="hidden"
      animate="show"
      variants={staggerKids(reduceMotion ? 0 : 0.03, reduceMotion ? 0 : 0.02)}
      className="space-y-0.5"
      aria-label="Assigned clients"
    >
      {clients.map((engagement) => (
        <m.li key={engagement.id} variants={itemVariants}>
          <InternClientRow
            engagement={engagement}
            pathname={pathname}
            onNavigate={onNavigate}
            ink={ink}
            hoverFollow={hoverFollow}
          />
        </m.li>
      ))}
    </m.ul>
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
      panel={({ showRail, ink: panelInk, onNavigate: panelNav, hoverFollow: panelHover }) => (
        <InternClientsPanel
          pathname={pathname}
          loading={loading}
          clients={clients}
          showRail={showRail}
          ink={panelInk}
          onNavigate={panelNav}
          hoverFollow={panelHover}
        />
      )}
    />
  );
}
