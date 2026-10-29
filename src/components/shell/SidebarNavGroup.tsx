'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { fadeOpacity, sidebarPanelStagger, springGentle } from '@/lib/shell/motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell/shell-appearance';
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

/* Active item, per sidebar skin (docs/design/TOKENS.md). Navy skin: the pill is
   side-active and the rail side-ink. White skin: brand-soft and brand. No
   borders or inset highlights on the pill; the fill is the whole signal. */
export function sidebarPillClass(ink: SidebarInk) {
  /* R-45: the picked row has a soft blurple fill (side-active) and lilac text. */
  return cn('absolute inset-0 rounded-md', ink === 'light' ? 'bg-side-active' : 'bg-brand-soft');
}

/* No translate — layoutId projection owns transform. */
/* VCFO Spectrum (R-45) drops the coloured edge on the picked row; the fill alone marks it.
   The rail element stays so the layout animation keys do not change, but it draws nothing. */
export function sidebarRailClass(_ink: SidebarInk, leaf = false) {
  return cn('absolute left-0 z-[2] hidden', leaf ? 'bottom-1.5 top-1.5' : 'bottom-2 top-2');
}

export function sidebarActiveTextClass(ink: SidebarInk) {
  return ink === 'light' ? 'font-medium text-side-active-ink' : 'font-medium text-brand-text';
}

export function sidebarInactiveOnSkin(ink: SidebarInk, hoverSoft: string, fillHover = true) {
  return ink === 'light'
    ? cn('text-side-ink hover:text-white', fillHover && 'hover:bg-side-hover')
    : cn('text-ink-muted hover:text-ink', fillHover && hoverSoft);
}

export function sidebarNavTriggerClass({
  ink,
  active,
  expanded,
  fillHover,
  stacked = false,
}: {
  ink: SidebarInk;
  active: boolean;
  expanded: boolean;
  fillHover: boolean;
  /** Pinned-closed rail: icon over a short label instead of an icon-only square. */
  stacked?: boolean;
}) {
  return cn(
    'nav-item sidebar-nav-disclosure-trigger relative flex w-full items-center transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
    stacked
      ? 'min-h-[3.15rem] flex-col justify-center gap-0.5 rounded-md px-0 py-1.5 text-[10px]'
      : 'min-h-[34px] gap-2.5 rounded-md px-2.5 text-[14px]',
    active ? sidebarActiveTextClass(ink) : sidebarInactiveOnSkin(ink, 'hover:bg-surface-sunken', fillHover),
    !expanded && !stacked && 'justify-center px-0',
  );
}

/** The word under the icon on the pinned-closed rail. Two lines, then it clips. */
export function SidebarRailLabel({ children }: { children: ReactNode }) {
  return (
    <span className="relative z-10 line-clamp-2 w-full break-words text-center text-[10px] font-medium leading-[1.1]">
      {children}
    </span>
  );
}

/** Count chip parked in the corner — a stacked cell has no room for a meta row. */
export function SidebarRailBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="mono absolute right-0.5 top-0.5 z-10 min-w-[0.95rem] rounded-sm bg-brand px-1 py-px text-center text-[9px] font-medium tabular-nums text-on-brand">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * R-49: an urgent count on a rail icon, as a small red badge in the corner. Other counts
 * wait for the full sidebar. The ring matches the skin so the badge reads as cut out.
 */
export function SidebarRailUrgentBadge({ count, ink = 'light' }: { count: number; ink?: SidebarInk }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      data-rail-urgent=""
      className={cn(
        'absolute right-0.5 top-0.5 z-10 grid h-4 min-w-4 place-items-center rounded-mark bg-danger-mid px-[3px] text-[10px] font-medium leading-none tabular-nums text-on-status ring-2',
        ink === 'light' ? 'ring-side' : 'ring-surface-raised',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function isSidebarGroupActive(pathname: string, children: SidebarNavLeaf[]) {
  return children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
}

export function SidebarNavCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="relative z-10 min-w-[18px] text-center text-[12px] font-medium tabular-nums text-side-muted">
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
          ? ink === 'light'
            ? 'text-side-ink/80'
            : 'text-brand/80'
          : ink === 'light'
            ? 'text-side-muted'
            : 'text-ink-muted',
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
            ? 'border-side-line before:bg-side-muted'
            : 'border-line before:bg-line-strong'),
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
  stacked = false,
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
  stacked?: boolean;
}) {
  return (
    <>
      {hoverFollow ? <SidebarHoverGlass itemId={hoverKey} follow={hoverFollow} /> : null}
      {sectionActive ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-active`}
          reduced={reduceMotion}
          className={sidebarPillClass(ink)}
        />
      ) : null}
      {sectionActive && sidebarExpanded ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-rail`}
          reduced={reduceMotion}
          className={sidebarRailClass(ink)}
        />
      ) : null}
      <Icon
        className={cn(
          'relative z-10 shrink-0',
          stacked ? 'h-[1.15rem] w-[1.15rem]' : 'h-4 w-4',
          sectionActive ? (ink === 'light' ? 'text-side-active-ink' : 'text-brand-text') : iconTone,
        )}
        strokeWidth={1.75}
      />
      {stacked ? <SidebarRailLabel>{label}</SidebarRailLabel> : null}
      {stacked ? <SidebarRailBadge count={badge ?? 0} /> : null}
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
  stacked = false,
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
  /** Pinned-closed rail: icon over a short label. */
  stacked?: boolean;
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
  const { sidebar } = useShellAppearance();
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
    stacked,
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
      stacked={stacked}
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
        {/* The flyout is portalled out of the rail, so the skin vars have to be
            re-applied here or it paints plain `bg-surface-raised` beside a themed rail. */}
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          className={cn(
            'shell-sidebar-skin w-[16.25rem] overflow-hidden rounded-lg p-2 shadow-float',
            sidebar.ink === 'light' ? 'border-side-line' : 'border-line',
          )}
          data-ink={sidebar.ink}
          style={surfaceCssVars(sidebar, 'sidebar')}
        >
          <div className="mb-1.5 flex items-center justify-between px-1.5 pt-0.5">
            <span
              className={cn(
                'text-[11px] font-semibold tracking-[0.06em]',
                sidebar.ink === 'light' ? 'text-side-muted' : 'text-ink-muted',
              )}
            >
              {label}
            </span>
            {flyoutAside}
          </div>
          {panel({
            showRail: false,
            ink: sidebar.ink,
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
        'relative flex min-h-[2.25rem] items-center gap-2 rounded-md py-1 pl-2.5 pr-1.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        active
          ? sidebarActiveTextClass(ink)
          : sidebarInactiveOnSkin(ink, 'hover:bg-surface-sunken', !followed),
      )}
      {...(hoverFollow ? sidebarHoverAttrs(itemId) : undefined)}
    >
      {hoverFollow ? <SidebarHoverGlass itemId={itemId} follow={hoverFollow} /> : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-${groupId}-leaf-active`}
          reduced={reduceMotion}
          className={sidebarPillClass(ink)}
        />
      ) : null}
      {active ? (
        <MotionActivePill
          layoutId={`${layoutIdPrefix}-${groupId}-leaf-rail`}
          reduced={reduceMotion}
          className={sidebarRailClass(ink, true)}
        />
      ) : null}
      <Icon
        className={cn(
          'relative z-10 h-3.5 w-3.5 shrink-0',
          active ? (ink === 'light' ? 'text-side-active-ink' : 'text-brand-text') : child.iconTone,
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
  stacked = false,
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
  stacked?: boolean;
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
      stacked={stacked}
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
