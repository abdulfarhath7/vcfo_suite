/**
 * Shared Framer Motion presets — orange-primary design system.
 * Spring motion for page enter, lists, and interactive surfaces.
 * Default ease fallback: in-out-quart-ish [0.22, 1, 0.36, 1].
 */
import type { Transition, Variants } from 'framer-motion';

export const ease = [0.22, 1, 0.36, 1] as const;

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

export const listStagger = {
  staggerChildren: 0.06,
  delayChildren: 0.04,
} as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: springGentle },
};

export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

export const staggerKids = (stagger = 0.06, delayChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

export const pageEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: springGentle,
} as const;

export const pageEnterReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
} as const;

export const cardHover = {
  whileHover: { y: -2 },
  transition: springSnappy,
} as const;

export const pressScale = {
  whileTap: { scale: 0.98 },
  transition: springSnappy,
} as const;
