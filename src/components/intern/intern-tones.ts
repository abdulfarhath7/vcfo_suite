import { TONE_BADGE, TONE_BG, TONE_TEXT, type IconChipTone } from '@/components/common/IconChip';
import type { InternChipTone } from '@/lib/intern-work';

export function internIconTone(tone: InternChipTone): IconChipTone {
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

export const KIND_TONE: Record<string, InternChipTone> = {
  rejected: 'danger',
  review: 'primary',
  deliver: 'teal',
  overdue: 'danger',
  'in-progress': 'sky',
  'waiting-client': 'violet',
  'waiting-manager': 'pink',
  'waiting-request': 'cyan',
  filing: 'cyan',
  done: 'success',
};

export function internKindChipLabel(kind: string): string {
  if (kind === 'in-progress') return 'In progress';
  return kind.replaceAll('-', ' ');
}
