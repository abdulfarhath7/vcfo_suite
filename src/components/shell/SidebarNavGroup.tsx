'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type ComponentType } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { fadeUp, fadeUpReduced, springGentle, staggerKids } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  SidebarHoverGlass,
  sidebarHoverHandlers,
  type SidebarHoverFollow,
} from '@/components/shell/MotionActivePill';

export type SidebarNavLeaf = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone?: string;
};

type SidebarInk = 'light' | 'dark';

function inactiveOnSkin(ink: SidebarInk, hoverSoft: string, fillHover = true) {
  return ink === 'light'
    ? cn('text-white/90 hover:text-white', fillHover && 'hover:bg-white/12')
    : cn('text-muted-foreground hover:text-foreground', fillHover && hoverSoft);
}

export function isSidebarGroupActive(pathname: string, children: SidebarNavLeaf[]) {
  return children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`));
}

function SidebarGroupRow({
  child,
  pathname,
  onNavigate,
  ink,
  hoverFollow,
}: {
  child: SidebarNavLeaf;
  pathname: string;
  onNavigate?: () => void;
  ink: SidebarInk;
  hoverFollow?: SidebarHoverFollow;
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
          ? 'bg-role-soft/80 text-role-foreground'
          : inactiveOnSkin(ink, 'hover:bg-role-soft/45', !followed),
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
}: {
  pathname: string;
  items: SidebarNavLeaf[];
  ink: SidebarInk;
  showRail: boolean;
  onNavigate?: () => void;
  hoverFollow?: SidebarHoverFollow;
}) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion ? fadeUpReduced : fadeUp;

  return (
    <div
      className={cn(
        showRail &&
          'relative border-l pl-2.5 before:absolute before:-left-px before:top-0 before:h-1.5 before:w-px',
        showRail &&
          (ink === 'light'
            ? 'border-white/25 before:bg-white/40'
            : 'border-primary/25 before:bg-primary/40'),
      )}
    >
      <m.div
        className="space-y-0.5 py-0.5 pr-0.5"
        variants={staggerKids(0.04, 0.02)}
        initial="hidden"
        animate="show"
      >
        {items.map((child) => (
          <m.div key={child.to} variants={variants}>
            <SidebarGroupRow
              child={child}
              pathname={pathname}
              onNavigate={onNavigate}
              ink={ink}
              hoverFollow={hoverFollow}
            />
          </m.div>
        ))}
      </m.div>
    </div>
  );
}

export function SidebarNavGroup({
  id,
  label,
  icon: Icon,
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
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const sectionActive = isSidebarGroupActive(pathname, items);
  const [open, setOpen] = useState(sectionActive);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const hoverKey = `group:${id}`;

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  const triggerClass = cn(
    'nav-item relative flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
    sectionActive
      ? 'font-medium text-role-foreground'
      : inactiveOnSkin(ink, 'hover:bg-role-soft/50', !hoverFollow),
    !expanded && 'justify-center px-0',
  );

  const triggerInner = (
    <>
      {hoverFollow ? <SidebarHoverGlass itemId={hoverKey} follow={hoverFollow} /> : null}
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
          className="absolute bottom-2 left-0 top-2 z-[2] w-[3px] rounded-full bg-role"
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
          <span className="relative z-10 flex-1 truncate text-left">{label}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              'relative z-10 h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out',
              sectionActive
                ? 'text-role-foreground/80'
                : ink === 'light'
                  ? 'text-white/80'
                  : 'text-muted-foreground',
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
            title={label}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={flyoutOpen}
            className={triggerClass}
            {...(hoverFollow ? sidebarHoverHandlers(hoverFollow, hoverKey) : undefined)}
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
          <div className="mb-1.5 px-1.5 pt-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          </div>
          <SidebarGroupPanel
            pathname={pathname}
            items={items}
            showRail={false}
            ink="dark"
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
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
        {...(hoverFollow ? sidebarHoverHandlers(hoverFollow, hoverKey) : undefined)}
      >
        {triggerInner}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            key={`${id}-panel`}
            id={panelId}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.16 } : springGentle}
            className="overflow-hidden"
          >
            <SidebarGroupPanel
              pathname={pathname}
              items={items}
              showRail
              ink={ink}
              onNavigate={onNavigate}
              hoverFollow={hoverFollow}
            />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
