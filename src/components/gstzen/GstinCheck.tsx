'use client';

import { Loader2, SearchCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGstinCheck, useGstzenStatus } from '@/hooks/use-gstzen';
import { cn } from '@/lib/utils';

/**
 * "Check on GSTN" on the GST registration tracker (staff only, once a GSTIN is recorded). It reads
 * the GSTIN validator through GSTZen and shows the legal name, status and jurisdiction for the person
 * to confirm. Nothing is saved by the check: a person who records the tracker can copy the
 * jurisdiction into its field with "Use this jurisdiction". Hidden while the GSTZen route is closed.
 */
export function GstinCheck({
  engagementId,
  gstin,
  onUseJurisdiction,
  className,
}: {
  engagementId: string;
  gstin: string;
  /** Present when the viewer may record the tracker. */
  onUseJurisdiction?: (jurisdiction: string) => void;
  className?: string;
}) {
  const status = useGstzenStatus(engagementId);
  const check = useGstinCheck();
  if (!status.data?.open) return null;
  const r = check.data;
  const same = r && status.data.gstin === gstin;
  return (
    <div className={cn('grid gap-2 rounded-md border border-line bg-surface-sunken/50 p-3 text-[13px]', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={check.isPending} onClick={() => check.mutate(engagementId)}>
          {check.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <SearchCheck aria-hidden />}
          Check on GSTN
        </Button>
        <span className="text-[12.5px] text-ink-muted">Reads the GSTIN’s legal name, status and jurisdiction from GSTN for you to confirm.</span>
      </div>
      {check.isError ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {check.error instanceof Error ? check.error.message : 'The check failed.'}
        </p>
      ) : null}
      {r && same ? (
        r.valid ? (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-muted">Legal name</dt>
            <dd className="font-medium">{r.legalName ?? '—'}</dd>
            {r.tradeName && r.tradeName !== r.legalName ? (
              <>
                <dt className="text-ink-muted">Trade name</dt>
                <dd>{r.tradeName}</dd>
              </>
            ) : null}
            <dt className="text-ink-muted">Status</dt>
            <dd className={cn(r.status && /active/i.test(r.status) ? 'text-positive' : 'text-warning')}>{r.status ?? '—'}</dd>
            <dt className="text-ink-muted">Jurisdiction</dt>
            <dd>{r.jurisdiction ?? '—'}</dd>
            {r.registeredOn ? (
              <>
                <dt className="text-ink-muted">Registered on</dt>
                <dd>{r.registeredOn}</dd>
              </>
            ) : null}
            {r.taxpayerType ? (
              <>
                <dt className="text-ink-muted">Taxpayer type</dt>
                <dd>{r.taxpayerType}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="text-[12.5px] text-danger">GSTN does not know this GSTIN. Check the number on the registration certificate.</p>
        )
      ) : null}
      {r && same && r.valid && r.jurisdiction && onUseJurisdiction ? (
        <div>
          <Button size="sm" variant="soft" onClick={() => onUseJurisdiction(r.jurisdiction!)}>
            Use this jurisdiction
          </Button>
        </div>
      ) : null}
    </div>
  );
}
