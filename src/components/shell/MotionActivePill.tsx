'use client';

import { m } from 'framer-motion';
import { springSnappy } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Shared-element highlight that slides between siblings (sidebar, rails, tabs). */
export function MotionActivePill({
  layoutId,
  className,
  reduced,
}: {
  layoutId: string;
  className?: string;
  reduced?: boolean | null;
}) {
  if (reduced) {
    return <span aria-hidden className={className} />;
  }

  return (
    <m.div
      layoutId={layoutId}
      aria-hidden
      className={className}
      transition={springSnappy}
    />
  );
}

export type SidebarHoverFollow = {
  hoverId: string | null;
  visible: boolean;
  onEnter: (id: string) => void;
  layoutId: string;
  reduced: boolean;
  ink: 'light' | 'dark';
};

export function sidebarHoverGlassClass(ink: 'light' | 'dark') {
  return cn(
    'pointer-events-none absolute inset-0 z-[1] rounded-[inherit]',
    ink === 'light'
      ? 'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-inset ring-white/20 backdrop-blur-md'
      : 'bg-black/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-inset ring-black/[0.07] backdrop-blur-md dark:bg-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-white/12',
  );
}

export function sidebarHoverHandlers(follow: SidebarHoverFollow, itemId: string) {
  return {
    onMouseEnter: () => follow.onEnter(itemId),
    onFocus: () => follow.onEnter(itemId),
  };
}

/** Frosted hover glass. Stays mounted on the last item so opacity can fade out. */
export function MotionHoverPill({
  layoutId,
  className,
  reduced,
  visible,
}: {
  layoutId: string;
  className?: string;
  reduced?: boolean | null;
  visible: boolean;
}) {
  if (reduced) {
    return visible ? <span aria-hidden className={className} /> : null;
  }

  return (
    <m.div
      layoutId={layoutId}
      aria-hidden
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{
        ...springSnappy,
        opacity: { duration: 0.16 },
      }}
    />
  );
}

export function SidebarHoverGlass({
  itemId,
  follow,
  className,
}: {
  itemId: string;
  follow: SidebarHoverFollow;
  className?: string;
}) {
  if (follow.hoverId !== itemId) return null;
  return (
    <MotionHoverPill
      layoutId={follow.layoutId}
      reduced={follow.reduced}
      visible={follow.visible}
      className={cn(sidebarHoverGlassClass(follow.ink), className)}
    />
  );
}
