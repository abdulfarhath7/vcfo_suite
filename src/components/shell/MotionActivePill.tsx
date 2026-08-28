'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react';
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

export function sidebarHoverIdFromNode(node: EventTarget | null): string | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest('[data-sidebar-hover]');
  if (!(el instanceof HTMLElement)) return null;
  return el.dataset.sidebarHover || null;
}

export function sidebarHoverAttrs(itemId: string) {
  return { 'data-sidebar-hover': itemId } as const;
}

export function sidebarHoverGlassClass(ink: 'light' | 'dark') {
  return cn(
    /* Tint/ring only. Item-sized blur is tempting but layoutId re-samples it every frame. */
    'sidebar-hover-glass pointer-events-none absolute inset-0 z-[1] rounded-[inherit]',
    ink === 'light'
      ? 'bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ring-1 ring-inset ring-white/20'
      : 'bg-black/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-inset ring-black/[0.07] dark:bg-white/[0.10] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-white/12',
  );
}

/** @deprecated Prefer data-sidebar-hover + useSidebarHoverFollow nav props. */
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
  follow: SidebarHoverFollow | undefined;
  className?: string;
}) {
  if (!follow || follow.hoverId !== itemId) return null;
  return (
    <MotionHoverPill
      layoutId={follow.layoutId}
      reduced={follow.reduced}
      visible={follow.visible}
      className={cn(sidebarHoverGlassClass(follow.ink), className)}
    />
  );
}

export function useSidebarHoverFollow(
  layoutIdPrefix: string,
  ink: 'light' | 'dark',
  reduced: boolean,
) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const lastId = useRef<string | null>(null);

  const onEnter = useCallback((id: string) => {
    if (lastId.current !== id) {
      lastId.current = id;
      setHoverId(id);
    }
    setVisible((open) => open || true);
  }, []);

  const onLeave = useCallback(() => {
    lastId.current = null;
    setVisible(false);
  }, []);

  const follow = useMemo<SidebarHoverFollow>(
    () => ({
      hoverId,
      visible,
      onEnter,
      layoutId: `${layoutIdPrefix}-hover`,
      reduced,
      ink,
    }),
    [hoverId, visible, onEnter, layoutIdPrefix, reduced, ink],
  );

  const navHoverProps = useMemo(
    () => ({
      onPointerLeave: onLeave,
      onPointerOver: (event: PointerEvent<HTMLElement>) => {
        const id = sidebarHoverIdFromNode(event.target);
        if (id) onEnter(id);
      },
      onFocusCapture: (event: FocusEvent<HTMLElement>) => {
        const id = sidebarHoverIdFromNode(event.target);
        if (id) onEnter(id);
      },
      onBlurCapture: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onLeave();
        }
      },
    }),
    [onEnter, onLeave],
  );

  return { follow, onLeave, navHoverProps };
}
