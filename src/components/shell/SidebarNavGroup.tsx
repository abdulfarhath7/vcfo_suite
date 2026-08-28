'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { fadeOpacity, sidebarPanelStagger, springGentle } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MotionActivePill,
  SidebarHoverGlass,
  sidebarHoverAttrs,
  type SidebarHoverFollow,
} from '@/components/shell/MotionActivePill';

export type SidebarNavLeaf = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
};

export type SidebarInk = 'light' | 'dark';

const PILL_CLASS =
  'absolute inset-0 rounded-xl border border-role/25 bg-role-soft shadow-[inset_0_1px_0_oklch(100%_0_0/0.35)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.07)]';
const RAIL_CLASS = 'absolute bottom-2 left-0 top-2 z-[2] w-[3px] rounded-full bg-role';
const LEAF_PILL_CLASS =
  'absolute inset-0 rounded-lg border border-role/20 bg-role-soft/80 shadow-[inset_0_1px_0_oklch(100%_0_0/0.28)] dark:shadow-[inset_0_1px_0_oklch(100%_0_0/0.06)]';
/* No translate — layoutId projection owns transform. */
const LEAF_RAIL_CLASS = 'absolute bottom-1.5 left-0 top-1.5 z-[2] w-[2.5px] rounded-full bg-role';

export function sidebarInactiveOnSkin(ink: SidebarInk, hoverSoft: string, fillHover = true) {
  return ink === 'light'
    ? cn('text-white/90 hover:text-white', fillHover && 'hover:bg-white/12')
    : cn('text-muted-foreground hover:text-foreground', fillHover && hoverSoft);
}

export function sidebarNavTriggerClass({
  ink,
  active,
  expanded,
  fillHover,
}: {
  ink: SidebarInk;
  active: boolean;
  expanded: boolean;
  fillHover: boolean;
}) {
  return cn(
    'nav-item sidebar-nav-disclosure-trigger relative flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
    active
      ? 'font-medium text-role-foreground'
      : sidebarInactiveOnSkin(ink, 'hover:bg-role-soft/50', fillHover),
    !expanded && 'justify-center px-0',
  );
}

export function isSidebarGroupActive(pathname: string, children: SidebarNavLeaf[]) {
  return children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
}

export function SidebarNavCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="relative z-10 mono min-w-[1.25rem] rounded-full bg-role px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SidebarNavChevron({
  open,
  ink,
  active,
}: {
  open: boolean;
  ink: SidebarInk;
  active: boolean;
}) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        'h-3.5 w-3.5 shrink-0 fill-none transition-transform duration-300 ease-out',
        active
          ? 'text-role-foreground/80'
          : ink === 'light'
            ? 'text-white/80'
            : 'text-muted-foreground',
        open && 'rotate-180',
      )}
      strokeWidth={1.75}
    />
  );
}

export function SidebarNavGroupRail({
  showRail,
  ink,
  children,
  className,
}: {
  showRail: boolean;
  ink: SidebarInk;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sidebar-nav-disclosure-panel',
        showRail &&
          'relative border-l pl-2.5 before:absolute before:-left-px before:top-0 before:h-1.5 before:w-px',
        showRail &&
          (ink === 'light'
            ? 'border-white/25 before:bg-white/40'
            : 'border-primary/25 before:bg-primary/40'),
        className,
      )}
    >
      {children}
    </div>
  );
}

function SidebarNavTriggerFace({
  icon: Icon,
  iconTone,
  label,
  badge,
  showChevron,
  chevronOpen,
  sidebarExpanded,
  sectionActive,
  ink,
  hoverFollow,
  hoverKey,
  layoutIdPrefix,
  reduceMotion,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
  label: string;
  badge?: number;
  showChevron: boolean;
  chevronOpen: boolean;
  sidebarExpanded: boolean;
  sectionActive: boolean;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  hoverKey: string;
  layoutIdPrefix: string;
  reduceMotion: boolean | null;
}) {
  return (
    <>
      {hoverFollow ? <SidebarHoverGlass itemId={hoverKey} follow={hoverFollow} /> : null}
      {sectionActive ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-active`}
          reduced={reduceMotion}
          className={PILL_CLASS}
        />
      ) : null}
      {sectionActive && sidebarExpanded ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-rail`}
          reduced={reduceMotion}
          className={RAIL_CLASS}
        />
      ) : null}
      <Icon
        className={cn(
          'relative z-10 h-4 w-4 shrink-0',
          sectionActive ? 'text-role-foreground' : iconTone,
        )}
        strokeWidth={1.75}
      />
      <span
        className={cn(
          'relative z-10 min-w-0 flex-1 truncate text-left',
          !sidebarExpanded && 'hidden',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'sidebar-nav-disclosure-meta relative z-10 ml-auto inline-flex shrink-0 items-center gap-1',
          !sidebarExpanded && 'hidden',
        )}
      >
        <SidebarNavCountBadge count={badge ?? 0} />
        {showChevron ? (
          <SidebarNavChevron open={chevronOpen} ink={ink} active={sectionActive} />
        ) : null}
      </span>
    </>
  );
}

export function SidebarNavDisclosure({
  id,
  label,
  icon,
  iconTone,
  badge,
  sidebarExpanded,
  sectionActive,
  layoutIdPrefix,
  ink = 'dark',
  hoverFollow,
  hoverKey,
  ariaLabel,
  onNavigate,
  flyoutAside,
  panel,
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
  badge?: number;
  sidebarExpanded: boolean;
  sectionActive: boolean;
  layoutIdPrefix: string;
  ink?: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  hoverKey: string;
  ariaLabel?: string;
  onNavigate?: () => void;
  flyoutAside?: ReactNode;
  panel: (ctx: {
    showRail: boolean;
    ink: SidebarInk;
    onNavigate?: () => void;
    hoverFollow?: SidebarHoverFollow;
    open: boolean;
  }) => ReactNode;
}) {
  const osReduce = useReducedMotion();
  const reduceMotion = Boolean(osReduce);
  const panelId = useId();
  const [open, setOpen] = useState(sectionActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [wideReady, setWideReady] = useState(sidebarExpanded);
  const wideMounted = useRef(sidebarExpanded);
  const compactMounted = useRef(!sidebarExpanded);
  if (sidebarExpanded || wideReady) wideMounted.current = true;
  if (!sidebarExpanded) compactMounted.current = true;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  useEffect(() => {
    if (sidebarExpanded) setFlyoutOpen(false);
  }, [sidebarExpanded]);

  useEffect(() => {
    if (wideReady) return;
    const idle = window.requestIdleCallback;
    const id = idle
      ? idle(() => setWideReady(true), { timeout: 900 })
      : window.setTimeout(() => setWideReady(true), 500);
    return () => {
      if (idle) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, [wideReady]);

  const triggerClass = sidebarNavTriggerClass({
    ink,
    active: sectionActive,
    expanded: sidebarExpanded,
    fillHover: !hoverFollow,
  });

  const triggerFace = (pillsReduced: boolean, glass: boolean) => (
    <SidebarNavTriggerFace
      icon={icon}
      iconTone={iconTone}
      label={label}
      badge={badge}
      showChevron={sidebarExpanded}
      chevronOpen={open}
      sidebarExpanded={sidebarExpanded}
      sectionActive={sectionActive}
      ink={ink}
      hoverFollow={glass ? hoverFollow : undefined}
      hoverKey={hoverKey}
      layoutIdPrefix={layoutIdPrefix}
      reduceMotion={pillsReduced}
    />
  );

  const labelForAria = ariaLabel ?? label;
  const hoverAttrs = hoverFollow ? sidebarHoverAttrs(hoverKey) : undefined;

  const flyout = compactMounted.current ? (
    <div hidden={sidebarExpanded}>
      <Popover open={!sidebarExpanded && flyoutOpen} onOpenChange={setFlyoutOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={label}
            aria-label={labelForAria}
            aria-haspopup="dialog"
            aria-expanded={flyoutOpen}
            className={triggerClass}
            tabIndex={sidebarExpanded ? -1 : undefined}
            {...hoverAttrs}
          >
            {triggerFace(sidebarExpanded ? true : reduceMotion, !sidebarExpanded)}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className="w-[16.25rem] rounded-2xl border-border/50 bg-panel p-2 shadow-[0_20px_56px_-28px_oklch(var(--shadow-ink)/0.32)]"
        >
          <div className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
            {flyoutAside}
          </div>
          {panel({
            showRail: false,
            ink: 'dark',
            open: true,
            onNavigate: () => {
              setFlyoutOpen(false);
              onNavigate?.();
            },
          })}
        </PopoverContent>
      </Popover>
    </div>
  ) : null;

  const accordion = wideMounted.current ? (
    <div hidden={!sidebarExpanded}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={labelForAria}
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
        {...hoverAttrs}
      >
        {triggerFace(sidebarExpanded ? reduceMotion : true, sidebarExpanded)}
      </button>
      <m.div
        id={panelId}
        initial={false}
        animate={
          reduceMotion
            ? { height: open ? 'auto' : 0, opacity: open ? 1 : 0 }
            : { height: open ? 'auto' : 0, opacity: open ? 1 : 0 }
        }
        transition={reduceMotion ? { duration: 0.12 } : springGentle}
        className="overflow-hidden"
        style={{ pointerEvents: open ? undefined : 'none' }}
      >
        {panel({
          showRail: true,
          ink,
          onNavigate,
          hoverFollow,
          open,
        })}
      </m.div>
    </div>
  ) : null;

  return (
    <div data-sidebar-nav-group={id}>
      {flyout}
      {accordion}
    </div>
  );
}

function SidebarGroupRow({
  child,
  pathname,
  onNavigate,
  ink,
  hoverFollow,
  layoutIdPrefix,
  groupId,
  reduceMotion,
}: {
  child: SidebarNavLeaf;
  pathname: string;
  onNavigate?: () => void;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
  layoutIdPrefix: string;
  groupId: string;
  reduceMotion: boolean;
}) {
  const Icon = child.icon;
  const active = pathname === child.to || pathname.startsWith(`${child.to}/`);
  const itemId = `group:${child.to}`;
  const followed = Boolean(hoverFollow);

  return (
    <Link
      href={child.to}
      onClick={onNavigate}
      title={child.label}
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
          layoutId={`${layoutIdPrefix}-${groupId}-leaf-active`}
          reduced={reduceMotion}
          className={LEAF_PILL_CLASS}
        />
      ) : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-${groupId}-leaf-rail`}
          reduced={reduceMotion}
          className={LEAF_RAIL_CLASS}
        />
      ) : null}
      <Icon
        className={cn(
          'relative z-10 h-3.5 w-3.5 shrink-0',
          active ? 'text-role-foreground' : child.iconTone,
        )}
        strokeWidth={1.75}
      />
      <span className="relative z-10 min-w-0 flex-1 truncate text-[12.5px] font-medium leading-tight">
        {child.label}
      </span>
    </Link>
  );
}

function SidebarGroupPanel({
  pathname,
  items,
  ink,
  showRail,
  onNavigate,
  hoverFollow,
  layoutIdPrefix,
  groupId,
  open,
}: {
  pathname: string;
  items: SidebarNavLeaf[];
  ink: SidebarInk;
  showRail: boolean;
  onNavigate?: () => void;
  hoverFollow?: SidebarHoverFollow;
  layoutIdPrefix: string;
  groupId: string;
  open: boolean;
}) {
  const osReduce = Boolean(useReducedMotion());
  const pillsReduced = osReduce || !showRail;

  return (
    <SidebarNavGroupRail showRail={showRail} ink={ink}>
      <m.div
        className="space-y-0.5 py-0.5 pr-0.5"
        variants={sidebarPanelStagger}
        initial={false}
        animate={open ? 'show' : 'hidden'}
      >
        {items.map((child) => (
          <m.div key={child.to} variants={fadeOpacity}>
            <SidebarGroupRow
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
              ink={ink}
              hoverFollow={hoverFollow}
              layoutIdPrefix={layoutIdPrefix}
              groupId={groupId}
              reduceMotion={pillsReduced}
            />
          </m.div>
        ))}
      </m.div>
    </SidebarNavGroupRail>
  );
}

export function SidebarNavGroup({
  id,
  label,
  icon,
  iconTone,
  items,
  expanded,
  pathname,
  layoutIdPrefix,
  onNavigate,
  ink = 'dark',
  hoverFollow,
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
  items: SidebarNavLeaf[];
  expanded: boolean;
  pathname: string;
  layoutIdPrefix: string;
  onNavigate?: () => void;
  ink?: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
}) {
  const sectionActive = isSidebarGroupActive(pathname, items);

  return (
    <SidebarNavDisclosure
      id={id}
      label={label}
      icon={icon}
      iconTone={iconTone}
      sidebarExpanded={expanded}
      sectionActive={sectionActive}
      layoutIdPrefix={layoutIdPrefix}
      ink={ink}
      hoverFollow={hoverFollow}
      hoverKey={`group:${id}`}
      onNavigate={onNavigate}
      panel={({ showRail, ink: panelInk, onNavigate: panelNav, hoverFollow: panelHover, open }) => (
        <SidebarGroupPanel
          pathname={pathname}
          items={items}
          showRail={showRail}
          ink={panelInk}
          onNavigate={panelNav}
          hoverFollow={panelHover}
          layoutIdPrefix={layoutIdPrefix}
          groupId={id}
          open={open}
        />
      )}
    />
  );
}
