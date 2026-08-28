/**
 * Shared Framer Motion presets — cool blue-primary design system.
 * Spring motion for page enter, lists, and interactive surfaces.
 * Default ease fallback: in-out-quart-ish [0.22, 1, 0.36, 1].
 */
import type { Transition, Variants } from 'framer-motion';

export const ease = [0.22, 1, 0.36, 1] as const;

/** macOS minimize — slow start, then a hard suck into the dock. */
export const genieEase = [0.42, 0, 0.9, 0.12] as const;
export const genieTransition: Transition = {
  duration: 0.72,
  ease: genieEase,
};

/** Shared-element pills (sidebar active / hover). Small nodes — a little overshoot is cheap. */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
};

export const springBounce: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 18,
};

/** Cheap compositor tween — prefer over springs for full-page / hover lift. */
export const tweenShort: Transition = {
  duration: 0.2,
  ease,
};

export const listStagger = {
  staggerChildren: 0.06,
  delayChildren: 0.04,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: tweenShort },
};

export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

/** Opacity-only — safe on ancestors of layoutId pills (transform would isolate projection). */
export const fadeOpacity: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.16, ease } },
};

export const staggerKids = (stagger = 0.06, delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Sidebar disclosure children — module-level so hover does not allocate variants. */
export const sidebarPanelStagger: Variants = staggerKids(0.03, 0.02);

export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: tweenShort,
} as const;

export const pageEnterReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const;

export const pageEnterDynamic = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease },
} as const;

export const pageEnterAmbient = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.45, ease },
} as const;

export const cardHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.16, ease },
} as const;

export const pressScale = {
  whileTap: { scale: 0.98 },
  transition: { duration: 0.12, ease },
} as const;

export const fadeSwap = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: tweenShort,
} as const;

export const fadeSwapReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.16 },
} as const;

/** Month canvas swap — opacity + short translate, not layout. `dir` is +1 next / −1 prev. */
export function monthPaneMotion(dir: 1 | -1, reduce: boolean) {
  if (reduce) return fadeSwapReduced;
  return {
    initial: { opacity: 0, x: dir * 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir * -14 },
    transition: tweenShort,
  };
}
