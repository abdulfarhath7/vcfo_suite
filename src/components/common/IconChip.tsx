import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconChipTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'role'
  | 'neutral'
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'orange'
  | 'teal'
  | 'pink'
  | 'cyan'
  | 'lime';

export type IconChipSize = 'sm' | 'md' | 'lg';

const TONE: Record<IconChipTone, { shell: string; icon: string }> = {
  primary: { shell: 'bg-primary-light', icon: 'text-primary-dark' },
  success: { shell: 'bg-success-light', icon: 'text-success-text' },
  warning: { shell: 'bg-warning-light', icon: 'text-warning-text' },
  danger: { shell: 'bg-danger-light', icon: 'text-danger-text' },
  info: { shell: 'bg-info-light', icon: 'text-info-text' },
  role: { shell: 'bg-role-soft', icon: 'text-role-foreground' },
  neutral: { shell: 'bg-raised', icon: 'text-muted-foreground' },
  emerald: { shell: 'bg-accent-emerald-soft', icon: 'text-accent-emerald' },
  sky: { shell: 'bg-accent-sky-soft', icon: 'text-accent-sky' },
  amber: { shell: 'bg-accent-amber-soft', icon: 'text-accent-amber' },
  violet: { shell: 'bg-accent-violet-soft', icon: 'text-accent-violet' },
  rose: { shell: 'bg-accent-rose-soft', icon: 'text-accent-rose' },
  orange: { shell: 'bg-accent-orange-soft', icon: 'text-accent-orange' },
  teal: { shell: 'bg-accent-teal-soft', icon: 'text-accent-teal' },
  pink: { shell: 'bg-accent-pink-soft', icon: 'text-accent-pink' },
  cyan: { shell: 'bg-accent-cyan-soft', icon: 'text-accent-cyan' },
  lime: { shell: 'bg-accent-lime-soft', icon: 'text-accent-lime' },
};

/** Categorical tones in stable order — use `toneForKey` to hash arbitrary
    strings (names, categories, tags) onto a consistent hue. */
export const CATEGORICAL_TONES: IconChipTone[] = [
  'sky',
  'violet',
  'emerald',
  'amber',
  'rose',
  'teal',
  'orange',
  'pink',
  'cyan',
  'lime',
];

export function toneForKey(key: string): IconChipTone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return CATEGORICAL_TONES[Math.abs(h) % CATEGORICAL_TONES.length];
}

/** Solid background class per tone — for bars, rails, dots. */
export const TONE_BG: Record<IconChipTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  role: 'bg-role',
  neutral: 'bg-muted-foreground',
  emerald: 'bg-accent-emerald',
  sky: 'bg-accent-sky',
  amber: 'bg-accent-amber',
  violet: 'bg-accent-violet',
  rose: 'bg-accent-rose',
  orange: 'bg-accent-orange',
  teal: 'bg-accent-teal',
  pink: 'bg-accent-pink',
  cyan: 'bg-accent-cyan',
  lime: 'bg-accent-lime',
};

/** Text color class per tone — for glyphs and small labels. */
export const TONE_TEXT: Record<IconChipTone, string> = {
  primary: 'text-primary-dark',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  info: 'text-info-text',
  role: 'text-role-foreground',
  neutral: 'text-muted-foreground',
  emerald: 'text-accent-emerald',
  sky: 'text-accent-sky',
  amber: 'text-accent-amber',
  violet: 'text-accent-violet',
  rose: 'text-accent-rose',
  orange: 'text-accent-orange',
  teal: 'text-accent-teal',
  pink: 'text-accent-pink',
  cyan: 'text-accent-cyan',
  lime: 'text-accent-lime',
};

/** Tinted text badge classes per tone — for tags/category pills. */
export const TONE_BADGE: Record<IconChipTone, string> = {
  primary: 'bg-primary-light text-primary-dark',
  success: 'bg-success-light text-success-text',
  warning: 'bg-warning-light text-warning-text',
  danger: 'bg-danger-light text-danger-text',
  info: 'bg-info-light text-info-text',
  role: 'bg-role-soft text-role-foreground',
  neutral: 'bg-raised text-muted-foreground',
  emerald: 'bg-accent-emerald-soft text-accent-emerald',
  sky: 'bg-accent-sky-soft text-accent-sky',
  amber: 'bg-accent-amber-soft text-accent-amber',
  violet: 'bg-accent-violet-soft text-accent-violet',
  rose: 'bg-accent-rose-soft text-accent-rose',
  orange: 'bg-accent-orange-soft text-accent-orange',
  teal: 'bg-accent-teal-soft text-accent-teal',
  pink: 'bg-accent-pink-soft text-accent-pink',
  cyan: 'bg-accent-cyan-soft text-accent-cyan',
  lime: 'bg-accent-lime-soft text-accent-lime',
};

const SIZE: Record<IconChipSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5' },
  md: { shell: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  lg: { shell: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5' },
};

interface Props {
  icon: LucideIcon;
  tone?: IconChipTone;
  size?: IconChipSize;
  className?: string;
}

/**
 * Tinted icon chip — the core "colorful icon" primitive of the design system.
 * Soft tone background + saturated glyph; works in both themes via tokens.
 */
export function IconChip({ icon: Icon, tone = 'primary', size = 'md', className }: Props) {
  const t = TONE[tone];
  const s = SIZE[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', s.shell, t.shell, className)}>
      <Icon className={cn(s.icon, t.icon)} />
    </span>
  );
}
