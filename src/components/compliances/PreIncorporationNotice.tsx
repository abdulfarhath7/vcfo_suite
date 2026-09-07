import { Landmark } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { IconChip } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

/**
 * PRE-INCORPORATION NOTICE — the one banner for "compliance opens after COI".
 *
 * Not a new primitive: it composes the inventory's callout (`Alert`) with an
 * `IconChip` and the login showcase's info tint, so the Calendar, the Filings
 * register, the staff tracker and the super admin rail all print the same
 * calm, bordered notice. Status colour lives in the icon tile and the border;
 * the panel is a tinted callout, never page fill.
 *
 * This file owns the copy. Callers decide *whether* to show it (from
 * `isIncorporated`, never a second rule) and pass the audience.
 */

export interface PreIncorporationScope {
  audience: 'client' | 'staff';
  companyName?: string;
}

function preIncorporationCopy(scope: PreIncorporationScope): string {
  if (scope.audience === 'client') {
    return 'Your compliance calendar and filings begin once your company is incorporated. Nothing’s due yet — this fills in automatically after your Certificate of Incorporation is issued.';
  }
  const who = scope.companyName?.trim() || 'This company';
  return `${who} isn’t incorporated yet. Its compliance calendar and filings generate automatically once the Certificate of Incorporation is recorded.`;
}

export function PreIncorporationNotice({
  scope,
  className,
}: {
  scope: PreIncorporationScope;
  className?: string;
}) {
  return (
    <Alert
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border-info/20 border-l-[3px] border-l-info bg-info-light px-4 py-3 text-foreground',
        className,
      )}
    >
      <IconChip icon={Landmark} tone="info" className="border border-info/25 bg-panel" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-info-text">
          Compliance begins after incorporation
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink">
          {preIncorporationCopy(scope)}
        </p>
      </div>
    </Alert>
  );
}

/**
 * Portfolio views keep their real instances; this is the optional one-liner
 * for "N engagements begin compliance after incorporation". Renders nothing
 * for zero so it never claims a count it does not have.
 */
export function PreIncorporationPortfolioNote({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <p className={cn('text-[11.5px] text-muted-foreground', className)}>
      {count === 1
        ? '1 engagement begins compliance after incorporation.'
        : `${count} engagements begin compliance after incorporation.`}
    </p>
  );
}
