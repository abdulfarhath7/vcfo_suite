import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Tones are states, not identities (docs/design/TOKENS.md). `primary` is the
 * brand, the four status tones always travel with a word, `highlight` is the
 * one orange moment per screen region, `neutral` is everything else.
 *
 * The nine categorical hues (emerald, sky, amber, ...) are kept as names so
 * existing callers compile, but they all render neutral now: colour-coding
 * tags, avatars and nav items by hash was the "different colours on every
 * card" the design system removes. Delete them on 2026-11-30.
 */
export type IconChipTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'highlight'
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

type IconChipSize = 'sm' | 'md' | 'lg';

const NEUTRAL = { shell: 'bg-surface-sunken', icon: 'text-ink-muted' };

const TONE: Record<IconChipTone, { shell: string; icon: string }> = {
  primary: { shell: 'bg-brand-soft', icon: 'text-brand' },
  success: { shell: 'bg-positive-soft', icon: 'text-positive' },
  warning: { shell: 'bg-warning-soft', icon: 'text-warning' },
  danger: { shell: 'bg-danger-soft', icon: 'text-danger' },
  info: { shell: 'bg-info-soft', icon: 'text-info' },
  highlight: { shell: 'bg-highlight-soft', icon: 'text-highlight' },
  role: { shell: 'bg-brand-soft', icon: 'text-brand' },
  neutral: NEUTRAL,
  emerald: NEUTRAL,
  sky: NEUTRAL,
  amber: NEUTRAL,
  violet: NEUTRAL,
  rose: NEUTRAL,
  orange: { shell: 'bg-highlight-soft', icon: 'text-highlight' },
  teal: NEUTRAL,
  pink: NEUTRAL,
  cyan: NEUTRAL,
  lime: NEUTRAL,
};

/** @deprecated Identity colour-coding is gone; every key maps to `neutral`. */
export const CATEGORICAL_TONES: IconChipTone[] = ['neutral'];

/** @deprecated Returns `neutral` for every key. Chips no longer carry identity colour. */
export function toneForKey(_key: string): IconChipTone {
  return 'neutral';
}

/** Solid background class per tone — for bars, rails, dots. */
export const TONE_BG: Record<IconChipTone, string> = {
  primary: 'bg-brand',
  success: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  highlight: 'bg-highlight-bright',
  role: 'bg-brand',
  neutral: 'bg-ink-faint',
  emerald: 'bg-ink-faint',
  sky: 'bg-ink-faint',
  amber: 'bg-ink-faint',
  violet: 'bg-ink-faint',
  rose: 'bg-ink-faint',
  orange: 'bg-highlight-bright',
  teal: 'bg-ink-faint',
  pink: 'bg-ink-faint',
  cyan: 'bg-ink-faint',
  lime: 'bg-ink-faint',
};

/** Text color class per tone — for glyphs and small labels. */
export const TONE_TEXT: Record<IconChipTone, string> = {
  primary: 'text-brand',
  success: 'text-positive',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  highlight: 'text-highlight',
  role: 'text-brand',
  neutral: 'text-ink-muted',
  emerald: 'text-ink-muted',
  sky: 'text-ink-muted',
  amber: 'text-ink-muted',
  violet: 'text-ink-muted',
  rose: 'text-ink-muted',
  orange: 'text-highlight',
  teal: 'text-ink-muted',
  pink: 'text-ink-muted',
  cyan: 'text-ink-muted',
  lime: 'text-ink-muted',
};

/** Tinted badge colours per tone: soft ground + text-safe colour. Pair with CHIP_CLASS. */
export const TONE_BADGE: Record<IconChipTone, string> = {
  primary: 'bg-brand-soft text-brand',
  success: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  highlight: 'bg-highlight-soft text-highlight',
  role: 'bg-brand-soft text-brand',
  neutral: 'bg-surface-sunken text-ink-muted',
  emerald: 'bg-surface-sunken text-ink-muted',
  sky: 'bg-surface-sunken text-ink-muted',
  amber: 'bg-surface-sunken text-ink-muted',
  violet: 'bg-surface-sunken text-ink-muted',
  rose: 'bg-surface-sunken text-ink-muted',
  orange: 'bg-highlight-soft text-highlight',
  teal: 'bg-surface-sunken text-ink-muted',
  pink: 'bg-surface-sunken text-ink-muted',
  cyan: 'bg-surface-sunken text-ink-muted',
  lime: 'bg-surface-sunken text-ink-muted',
};

/**
 * The one chip shape: 22px high, 8px side padding, 6px corners, 11px/600 text.
 * `CHIP_COLUMN_CLASS` adds the fixed minimum width and centred label for chips
 * that sit in a table column, so the column reads as one block.
 */
export const CHIP_CLASS =
  'inline-flex h-chip items-center gap-1 whitespace-nowrap rounded-sm px-2 text-[11px] font-semibold leading-4';
export const CHIP_COLUMN_CLASS = 'min-w-chip justify-center';

const SIZE: Record<IconChipSize, { shell: string; icon: string }> = {
  sm: { shell: 'h-6 w-6 rounded-md', icon: 'h-3.5 w-3.5' },
  md: { shell: 'h-8 w-8 rounded-md', icon: 'h-4 w-4' },
  lg: { shell: 'h-10 w-10 rounded-md', icon: 'h-5 w-5' },
};

interface Props {
  icon: LucideIcon;
  tone?: IconChipTone;
  size?: IconChipSize;
  className?: string;
}

/**
 * Tinted icon tile: soft tone ground + text-safe glyph, 8px corners. Neutral by
 * default; a status tone only when the tile means that status.
 */
export function IconChip({ icon: Icon, tone = 'neutral', size = 'md', className }: Props) {
  const t = TONE[tone];
  const s = SIZE[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', s.shell, t.shell, className)}>
      <Icon className={cn(s.icon, t.icon)} />
    </span>
  );
}
