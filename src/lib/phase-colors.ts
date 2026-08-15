/**
 * Journey phase color convention (cool blue primary + analogous washes).
 *
 * Brand/CTA/focus/current-step = BLUE only (`--primary` / `--blue-*`).
 * Phase tints are soft washes/chips on journey flowcharts — not competing primaries.
 *
 * | Phase id / bucket        | Token              | Hue intent   |
 * |--------------------------|--------------------|--------------|
 * | pre-inc-phase-1          | phase-pre          | Sky          |
 * | pre-inc-phase-2 (docs)   | phase-filing       | Teal         |
 * | post-inc-phase-3         | phase-post         | Teal-green   |
 * | fema bucket              | phase-fema         | Indigo       |
 * | registration-phase-4     | phase-registration | Violet-blue  |
 *
 * Prefer CSS vars / Tailwind `phase-*` utilities over one-off hex.
 */

export type PhaseColorKey =
  | 'pre'
  | 'filing'
  | 'post'
  | 'fema'
  | 'registration'
  | 'default';

export function phaseKeyFromId(phaseId: string, bucket?: string): PhaseColorKey {
  if (bucket === 'fema') return 'fema';
  switch (phaseId) {
    case 'pre-inc-phase-1':
      return 'pre';
    case 'pre-inc-phase-2':
      return 'filing';
    case 'post-inc-phase-3':
      return 'post';
    case 'registration-phase-4':
      return 'registration';
    default:
      if (bucket === 'pre-inc') return 'pre';
      if (bucket === 'post-inc') return 'post';
      if (bucket === 'statutory') return 'registration';
      return 'default';
  }
}

/** Tailwind-friendly class bundles for phase-tinted UI. */
export const PHASE_CLASSES: Record<
  PhaseColorKey,
  {
    text: string;
    soft: string;
    border: string;
    solid: string;
    ring: string;
    glow: string;
    label: string;
  }
> = {
  pre: {
    text: 'text-[oklch(var(--phase-pre-text))]',
    soft: 'bg-[oklch(var(--phase-pre-soft))]',
    border: 'border-[oklch(var(--phase-pre)/0.28)]',
    solid: 'bg-[oklch(var(--phase-pre))] text-white',
    ring: 'ring-[oklch(var(--phase-pre)/0.22)]',
    glow: 'shadow-[0_0_0_4px_oklch(var(--phase-pre-soft))]',
    label: 'text-[oklch(var(--phase-pre-text))]',
  },
  filing: {
    text: 'text-[oklch(var(--phase-filing-text))]',
    soft: 'bg-[oklch(var(--phase-filing-soft))]',
    border: 'border-[oklch(var(--phase-filing)/0.28)]',
    solid: 'bg-[oklch(var(--phase-filing))] text-white',
    ring: 'ring-[oklch(var(--phase-filing)/0.22)]',
    glow: 'shadow-[0_0_0_4px_oklch(var(--phase-filing-soft))]',
    label: 'text-[oklch(var(--phase-filing-text))]',
  },
  post: {
    text: 'text-[oklch(var(--phase-post-text))]',
    soft: 'bg-[oklch(var(--phase-post-soft))]',
    border: 'border-[oklch(var(--phase-post)/0.28)]',
    solid: 'bg-[oklch(var(--phase-post))] text-white',
    ring: 'ring-[oklch(var(--phase-post)/0.22)]',
    glow: 'shadow-[0_0_0_4px_oklch(var(--phase-post-soft))]',
    label: 'text-[oklch(var(--phase-post-text))]',
  },
  fema: {
    text: 'text-[oklch(var(--phase-fema-text))]',
    soft: 'bg-[oklch(var(--phase-fema-soft))]',
    border: 'border-[oklch(var(--phase-fema)/0.28)]',
    solid: 'bg-[oklch(var(--phase-fema))] text-white',
    ring: 'ring-[oklch(var(--phase-fema)/0.22)]',
    glow: 'shadow-[0_0_0_4px_oklch(var(--phase-fema-soft))]',
    label: 'text-[oklch(var(--phase-fema-text))]',
  },
  registration: {
    text: 'text-[oklch(var(--phase-registration-text))]',
    soft: 'bg-[oklch(var(--phase-registration-soft))]',
    border: 'border-[oklch(var(--phase-registration)/0.28)]',
    solid: 'bg-[oklch(var(--phase-registration))] text-white',
    ring: 'ring-[oklch(var(--phase-registration)/0.22)]',
    glow: 'shadow-[0_0_0_4px_oklch(var(--phase-registration-soft))]',
    label: 'text-[oklch(var(--phase-registration-text))]',
  },
  default: {
    text: 'text-primary',
    soft: 'bg-primary-light',
    border: 'border-primary/30',
    solid: 'bg-primary text-primary-foreground',
    ring: 'ring-primary/25',
    glow: 'shadow-[0_0_0_4px_oklch(var(--primary-light))]',
    label: 'text-primary',
  },
};

export function phaseClasses(phaseId: string, bucket?: string) {
  return PHASE_CLASSES[phaseKeyFromId(phaseId, bucket)];
}
