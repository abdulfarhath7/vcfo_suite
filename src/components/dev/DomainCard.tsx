'use client';

import { useQueryClient } from '@tanstack/react-query';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { DevCard, Pending, ReachNotice, StatusChip } from '@/components/dev/parts';
import { stamp } from '@/lib/dev/format';
import type { DomainCheck, DomainRecord, Reach } from '@/lib/dev/types';

const WORD: Record<DomainRecord['status'], { status: string; label: string }> = {
  verified: { status: 'ok', label: 'Verified' },
  pending: { status: 'pending', label: 'Pending' },
  missing: { status: 'failed', label: 'Missing' },
  failed: { status: 'failed', label: 'Failed' },
};

const columns: EFilingColumn<DomainRecord>[] = [
  { key: 'record', header: 'Record', width: '130px', render: (r) => <span className="font-medium text-ink">{r.record}</span> },
  { key: 'status', header: 'Status', width: '148px', render: (r) => <StatusChip status={WORD[r.status].status} label={WORD[r.status].label} /> },
  { key: 'value', header: 'Value', render: (r) => <span className="break-all font-mono text-[12px] text-ink-2">{r.value}</span> },
];

/**
 * "Email domain <domain>": SPF, DKIM, DMARC and return path from the live DNS and provider
 * check. "Verify" asks the server to check again (it refetches the query the card came from).
 */
export function DomainCard({ domain, error, queryUrl }: { domain: Reach<DomainCheck> | null | undefined; error?: unknown; queryUrl: string }) {
  const qc = useQueryClient();
  const title = domain?.state === 'ok' ? `Email domain ${domain.data.domain}` : 'Email domain';
  return (
    <DevCard
      title={title}
      meta={domain?.state === 'ok' ? `Checked ${stamp(domain.data.checkedAt)}` : undefined}
      right={
        domain ? (
          <Button size="sm" variant="secondary" onClick={() => void qc.invalidateQueries({ queryKey: ['dev', queryUrl] })}>
            Verify
          </Button>
        ) : null
      }
    >
      {!domain ? (
        <Pending error={error} rows={4} />
      ) : domain.state === 'ok' ? (
        <div className="px-2 pb-2">
          <EFilingGrid columns={columns} rows={domain.data.records} rowKey={(r) => r.record} minWidth={520} />
        </div>
      ) : (
        <ReachNotice reach={domain} service="The mail domain check" />
      )}
    </DevCard>
  );
}
