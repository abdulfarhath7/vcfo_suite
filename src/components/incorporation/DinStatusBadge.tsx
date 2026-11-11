import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { DIN_BADGE_LABEL, dinVerificationOf, type DinVerification } from '@/lib/checklist/din-verification';

const TONE: Record<DinVerification['kind'], ChipTone> = {
  verified: 'ok',
  mismatch: 'bad',
  'not-found': 'warn',
  'to-apply': 'prog',
  unchecked: 'idle',
};

function checkedOn(at: string | undefined): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * DR-01 / SB-02: one DIN badge per proposed director, with who checked it and when. The same
 * component sits on the director card and on the grid row.
 */
export function DinStatusBadge({ responses, entryId, compact = false }: {
  responses: Record<string, string | undefined>;
  entryId: string;
  compact?: boolean;
}) {
  const check = dinVerificationOf(responses, entryId);
  const when = 'at' in check ? checkedOn(check.at) : null;
  const who = 'by' in check ? check.by : undefined;
  const detail = [who && `by ${who}`, when].filter(Boolean).join(', ');
  const note = check.kind === 'mismatch' ? check.note : undefined;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1" data-din-status={check.kind}>
      <Chip tone={TONE[check.kind]} raw>{DIN_BADGE_LABEL[check.kind]}</Chip>
      {!compact && detail ? <span className="text-[12px] text-ink-muted">Checked {detail}</span> : null}
      {!compact && note ? <span className="text-[12px] text-danger">{note}</span> : null}
    </span>
  );
}
