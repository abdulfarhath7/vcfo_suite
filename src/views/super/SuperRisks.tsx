'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Tag, type ChipTone } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Button } from '@/components/ui/button';
import { RemindClientButton } from '@/components/reminders/RemindClientButton';
import {
  ClientTile,
  SuperPageError,
  SuperPageHead,
  SuperPageSkeleton,
} from '@/components/super/parts/super-parts';
import { shortCompany } from '@/components/super/parts/super-text';
import {
  buildRisks,
  SUPER_RISK_LABEL,
  type SuperRisk,
  type SuperRiskKind,
} from '@/components/super/insights/super-insights-model';
import { useSuperInsights } from '@/views/super/use-super-insights';
import { cn } from '@/lib/utils';

/**
 * RISKS (prototype `RisksScreen`).
 *
 * Built only from stored states and dates: steps marked overdue, filings past their due date
 * and not filed, clients with open work and no move for `SUPER_STUCK_DAYS` days (or blocked),
 * and clients with nobody assigned. Each row opens the client or the step behind it. An
 * overdue step or filing also has the one-click Remind to the client (G-15); when the
 * reminder cannot go out, the row's record opens instead so the super admin can follow up.
 * Assign stays with the owners' screens.
 */
export const SUPER_RISKS_HREF = '/app/super/risks';

const KINDS: SuperRiskKind[] = ['step', 'filing', 'stuck', 'owner', 'lead'];

const KIND_TONE: Record<SuperRiskKind, ChipTone> = {
  step: 'bad',
  filing: 'bad',
  stuck: 'warn',
  owner: 'violet',
  lead: 'violet',
};

function SeverityBars({ severity }: { severity: 1 | 2 | 3 }) {
  return (
    <span className="flex flex-none gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <i key={i} className={cn('h-3 w-1.5 rounded-[1px]', i <= severity ? 'bg-danger-mid' : 'bg-line')} />
      ))}
    </span>
  );
}

function ageLabel(risk: SuperRisk): string {
  if (risk.ageDays === null) return '–';
  if (risk.ageDays === 0) return 'Today';
  return `${risk.ageDays} days`;
}

/** Risks the client can act on: an overdue step or filing. The risk id is the item key. */
function remindKeyOf(risk: SuperRisk): string | null {
  return risk.kind === 'step' || risk.kind === 'filing' ? risk.id : null;
}

export default function SuperRisks() {
  const router = useRouter();
  const query = useSuperInsights();
  const insights = query.data;
  const [kind, setKind] = useState('all');

  const risks = useMemo(() => (insights ? buildRisks(insights, new Date()) : []), [insights]);

  const seo = <SEO title="Risks — VCFO Suite" description="Overdue steps, overdue filings and stuck clients." path={SUPER_RISKS_HREF} />;

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperPageSkeleton label="Loading risks" />
      </PageTransition>
    );
  }
  if (query.isError || !insights) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError title="Risks could not load" error={query.error} onRetry={() => void query.refetch()} />
      </PageTransition>
    );
  }

  const rows = risks.filter((r) => kind === 'all' || r.kind === kind);

  const columns: EFilingColumn<SuperRisk>[] = [
    {
      key: 'kind',
      header: 'Kind',
      width: '132px',
      render: (r) => (
        <Tag tone={KIND_TONE[r.kind]} className="w-[112px]">
          {SUPER_RISK_LABEL[r.kind]}
        </Tag>
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <ClientTile id={r.engagementId} name={r.companyName} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{r.title}</span>
            <span className="flex items-center gap-1.5 text-[12px] text-ink-muted" title={`Severity ${r.severity} of 3`}>
              <SeverityBars severity={r.severity} />
              <span className="truncate">{shortCompany(r.companyName)}</span>
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '180px',
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate">{r.managerName ?? 'No manager'}</span>
          <span className="block truncate text-[12px] text-ink-muted">{r.leadName ?? 'No lead'}</span>
        </span>
      ),
    },
    { key: 'age', header: 'Age', width: '90px', align: 'right', render: (r) => <span className="tabular-nums">{ageLabel(r)}</span> },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      width: '184px',
      align: 'right',
      render: (r) => {
        const key = remindKeyOf(r);
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            {key ? (
              <RemindClientButton
                engagementId={r.engagementId}
                itemKey={key}
                title={r.title}
                className="w-[88px]"
                onFailed={() => router.push(r.href)}
              />
            ) : null}
            <Button asChild size="sm" variant="outline" className="w-[76px]">
              <Link href={r.href}>Open</Link>
            </Button>
          </span>
        );
      },
    },
  ];

  return (
    <PageTransition>
      {seo}
      <div className="flex flex-col gap-5">
        <SuperPageHead title="Risks" meta={`${risks.length} open`} />
        <DashSection title="Risks" meta={String(rows.length)} bodyClassName="px-2 pb-2 pt-3">
          <div className="mb-2 px-2">
            <SpectrumTabs
              label="Kind"
              items={[
                { key: 'all', label: 'All', count: risks.length },
                ...KINDS.map((k) => ({ key: k, label: SUPER_RISK_LABEL[k], count: risks.filter((r) => r.kind === k).length })),
              ]}
              value={kind}
              onChange={setKind}
            />
          </div>
          <EFilingGrid caption="Risks" columns={columns} rows={rows} rowKey={(r) => r.id} empty="No risk of this kind" minWidth={908} pageSize={12} />
        </DashSection>
      </div>
    </PageTransition>
  );
}
