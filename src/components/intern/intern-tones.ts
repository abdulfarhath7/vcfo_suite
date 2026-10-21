import { TONE_BADGE, TONE_BG, TONE_TEXT, type IconChipTone } from '@/components/common/IconChip';
import type { InternChipTone } from '@/lib/intern-work';

function internIconTone(tone: InternChipTone): IconChipTone {
  return tone;
}

export function internToneBadge(tone: InternChipTone): string {
  return TONE_BADGE[internIconTone(tone)];
}

export function internToneBg(tone: InternChipTone): string {
  return TONE_BG[internIconTone(tone)];
}

export function internToneText(tone: InternChipTone): string {
  return TONE_TEXT[internIconTone(tone)];
}

/* A kind is a state, so it wears a status tone (docs/design/TOKENS.md): in flight
   is brand, waiting on someone is warning, late or rejected is danger, done is
   positive. The word on the chip carries the detail. */
export const KIND_TONE: Record<string, InternChipTone> = {
  rejected: 'danger',
  review: 'primary',
  deliver: 'primary',
  overdue: 'danger',
  'in-progress': 'primary',
  'waiting-client': 'warning',
  'waiting-manager': 'warning',
  'waiting-request': 'warning',
  filing: 'warning',
  done: 'success',
};

export function internKindChipLabel(kind: string): string {
  if (kind === 'in-progress') return 'In progress';
  const raw = kind.replaceAll('-', ' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
