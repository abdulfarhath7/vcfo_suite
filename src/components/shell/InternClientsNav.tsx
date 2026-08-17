'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useState, type ComponentType } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { initialsFromName } from '@/lib/auth';
import { internEngagementPath, isInternEngagementPathname } from '@/lib/project-step-path';
import { fadeUp, fadeUpReduced, springGentle, staggerKids } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Engagement } from '@/data/engagements';

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
}: {
  engagement: Engagement;
  pathname: string;
  onNavigate?: () => void;
}) {
  const href = internEngagementPath(engagement);
  const active = isEngagementNavActive(pathname, engagement);
  const subtitle = clientSubtitle(engagement);
  const initials = initialsFromName(engagement.companyName) || '•';

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
          : 'text-muted-foreground hover:bg-role-soft/45 hover:text-foreground',
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full bg-role"
        />
      ) : null}
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-light text-[9px] font-semibold text-primary-dark"
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-tight text-inherit">
          {engagement.companyName}
        </span>
        <span className="mt-px block truncate font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/80">
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
}: {
  pathname: string;
  onNavigate?: () => void;
  loading: boolean;
  clients: Engagement[];
  showRail: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const overviewActive = pathname === INTERN_CLIENTS_HREF || pathname.startsWith(`${INTERN_CLIENTS_HREF}/`);
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
    <p className="px-1 py-1.5 text-[11px] leading-snug text-muted-foreground">
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
          />
        </m.li>
      ))}
    </m.ul>
  );

  return (
    <div
      className={cn(showRail ? 'ml-[1.125rem] mt-0.5' : undefined)}
      aria-busy={loading || undefined}
    >
      <div
        className={cn(
          showRail &&
            'relative border-l border-primary/25 pl-2.5 before:absolute before:-left-px before:top-0 before:h-1.5 before:w-px before:bg-primary/40',
        )}
      >
        <div className="max-h-52 space-y-0.5 overflow-y-auto overscroll-contain py-0.5 pr-0.5">
          {loading ? <span className="sr-only">Loading clients</span> : null}
          {body}
          {!loading ? (
            <Link
              href={INTERN_CLIENTS_HREF}
              onClick={onNavigate}
              aria-current={overviewActive ? 'page' : undefined}
              className={cn(
                'relative mt-0.5 flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                overviewActive
                  ? 'font-medium text-role-foreground'
                  : 'text-muted-foreground/90 hover:bg-role-soft/40 hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3 w-3 shrink-0 opacity-80" strokeWidth={1.75} />
              <span className="truncate">View all</span>
            </Link>
          ) : null}
        </div>
      </div>
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
}: {
  expanded: boolean;
  pathname: string;
  layoutIdPrefix: string;
  onNavigate?: () => void;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
}) {
  const { clients, loading } = useAssignedInternClients();
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const sectionActive = isClientsSectionActive(pathname);
  const [open, setOpen] = useState(sectionActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  const count = loading ? 0 : clients.length;

  const triggerClass = cn(
    'nav-item relative flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
    sectionActive
      ? 'font-medium text-role-foreground'
      : 'text-muted-foreground hover:bg-role-soft/50 hover:text-foreground',
    !expanded && 'justify-center px-0',
  );

  const triggerInner = (
    <>
      {sectionActive ? (
        <m.div
          layoutId={`${layoutIdPrefix}-active`}
          className="absolute inset-0 rounded-xl border border-role/25 bg-role-soft shadow-[inset_0_1px_0_oklch(100%_0_0/0.35)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.07)]"
          transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
        />
      ) : null}
      {sectionActive && expanded ? (
        <m.div
          layoutId={`${layoutIdPrefix}-rail`}
          className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-role"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      ) : null}
      <Icon
        className={cn(
          'relative z-10 h-4 w-4 shrink-0',
          sectionActive ? 'text-role-foreground' : iconTone,
        )}
        strokeWidth={1.75}
      />
      {expanded ? (
        <>
          <span className="relative z-10 flex-1 truncate text-left">Clients</span>
          {count > 0 ? (
            <span className="relative z-10 min-w-[1.15rem] rounded-full bg-role-soft px-1.5 py-0.5 text-center font-mono text-[10px] font-medium tabular-nums text-role-foreground ring-1 ring-role/20">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn(
              'relative z-10 h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out',
              sectionActive ? 'text-role-foreground/80' : 'text-muted-foreground',
              open && 'rotate-180',
            )}
            strokeWidth={2}
          />
        </>
      ) : null}
    </>
  );

  if (!expanded) {
    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Clients"
            aria-label={count > 0 ? `Clients, ${count} assigned` : 'Clients'}
            aria-haspopup="dialog"
            aria-expanded={flyoutOpen}
            className={triggerClass}
          >
            {triggerInner}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-[16.25rem] rounded-2xl border-border/50 bg-panel/95 p-2 shadow-[0_20px_56px_-28px_oklch(var(--shadow-ink)/0.32)] backdrop-blur-2xl"
        >
          <div className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Clients
            </span>
            {count > 0 ? (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </div>
          <InternClientsPanel
            pathname={pathname}
            loading={loading}
            clients={clients}
            showRail={false}
            onNavigate={() => {
              setFlyoutOpen(false);
              onNavigate?.();
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count > 0 ? `Clients, ${count} assigned` : 'Clients'}
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        {triggerInner}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            key="intern-clients-panel"
            id={panelId}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.16 } : springGentle}
            className="overflow-hidden"
          >
            <InternClientsPanel
              pathname={pathname}
              onNavigate={onNavigate}
              loading={loading}
              clients={clients}
              showRail
            />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
