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
  | 'upcoming'
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
  upcoming: { shell: 'bg-upcoming-soft', icon: 'text-upcoming' },
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
  upcoming: 'bg-upcoming',
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
  upcoming: 'text-upcoming',
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
  upcoming: 'bg-upcoming-soft text-upcoming',
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
 * The one chip shape: 22px high, 8px side padding, 5px corners, 11px/600 text.
 * `CHIP_COLUMN_CLASS` adds the fixed minimum width and centred label for chips
 * that sit in a table column, so the column reads as one block.
 */
export const CHIP_CLASS =
  'inline-flex h-chip items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-[11px] font-semibold leading-4';
export const CHIP_COLUMN_CLASS = 'w-[var(--chip-min-width)] min-w-chip justify-center';

/**
 * One intensity for a state (K-04, rule R-13): a soft chip with a 6px dot in
 * the state's mid colour. Done, in progress, waiting or due, overdue and
 * upcoming all use this shape; never a solid block. The names TONE_SOLID and
 * internToneSolid stay so callers do not change. An OWNER or a tag is a soft
 * tint without a dot (TONE_BADGE above, TONE_OWNER below).
 */
export type StatusKey = 'done' | 'progress' | 'waiting' | 'overdue' | 'upcoming';
const DOT_BEFORE = "before:inline-block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:content-['']";
export const TONE_SOLID: Record<StatusKey, string> = {
  done: `bg-positive-soft text-positive ${DOT_BEFORE} before:bg-positive-mid`,
  progress: `bg-brand-soft text-brand ${DOT_BEFORE} before:bg-brand`,
  waiting: `bg-warning-soft text-warning ${DOT_BEFORE} before:bg-warning-mid`,
  overdue: `bg-danger-soft text-danger ${DOT_BEFORE} before:bg-danger-mid`,
  upcoming: `bg-upcoming-soft text-upcoming ${DOT_BEFORE} before:bg-upcoming`,
};
/** Solid chip colours keyed by the IconChipTone names callers already use. */
export const TONE_SOLID_BY_TONE: Partial<Record<IconChipTone, string>> = {
  success: TONE_SOLID.done,
  primary: TONE_SOLID.progress,
  warning: TONE_SOLID.waiting,
  danger: TONE_SOLID.overdue,
  upcoming: TONE_SOLID.upcoming,
  neutral: TONE_SOLID.upcoming,
  info: TONE_SOLID.progress,
};
export type OwnerKey = 'client' | 'sbc' | 'mca' | 'manager';
export const TONE_OWNER: Record<OwnerKey, string> = {
  client: 'bg-owner-client-soft text-owner-client',
  sbc: 'bg-owner-sbc-soft text-owner-sbc',
  mca: 'bg-owner-mca-soft text-owner-mca',
  manager: 'bg-owner-manager-soft text-owner-manager',
};
/**
 * The third form of a state, for dense lists (LeetCode's Easy / Medium / Hard): the word
 * alone in its colour at 600, no ground. `cn(STATE_WORD_CLASS, TONE_TEXT.success)`.
 */
export const STATE_WORD_CLASS = 'text-[12px] font-semibold whitespace-nowrap';
/** A 6px dot inside a soft chip, in the state's solid colour (SBC-Track style). */
export const CHIP_DOT_CLASS = 'inline-block h-1.5 w-1.5 shrink-0 rounded-sm';

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
