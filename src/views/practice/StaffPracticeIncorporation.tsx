'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Chip } from '@/components/ui/spectrum-chip';
import { PhaseBar } from '@/components/ui/step-track';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Button } from '@/components/ui/button';
import { ExportToExcelButton } from '@/components/ui/export-to-excel-button';
import { SuperNumberStrip, SuperPageError } from '@/components/super/parts/super-parts';
import { shortCompany, todayKey } from '@/components/super/parts/super-text';
import { plainDay } from '@/lib/date-format';
import { superOwnerOf, superPhaseTrack, superStateChip } from '@/components/super/overview/super-overview-format';
import { usePracticeMetrics } from '@/components/metrics/use-metrics';
import { usePracticeIncorporation } from '@/hooks/use-practice-incorporation';
import {
  practiceClientsHref,
  type PracticeIncorporationClient,
  type PracticeShellBase,
} from '@/lib/practice/practice-incorporation';
import { cn } from '@/lib/utils';
import {
  PRACTICE_WITH_WORD,
  incorporatingClients,
  isLatePracticeRow,
  practiceIncorporationRows,
  practiceStepCode,
  type PracticeWithKey,
} from '@/lib/practice/practice-incorporation-list';
import { stepSlugForItemId } from '@/lib/slug';
import { INCORPORATION_VIEWS, type IncorporationView } from '@/components/shell/sidebar-items';

/**
 * NV-01: the Incorporation sub-items open this list with a view. SPICe+ Part A and Part B show
 * the clients whose current step is in that part; Board resolutions the clients at the board
 * resolution steps; Documents every client, each row opening its document pack.
 */
const VIEW_TITLE: Record<IncorporationView, string> = {
  'part-a': 'SPICe+ Part A',
  'part-b': 'SPICe+ Part B',
  'board-resolutions': 'Board resolutions',
  documents: 'Documents',
};

function viewOf(value: string | null): IncorporationView | null {
  return (INCORPORATION_VIEWS as readonly string[]).includes(value ?? '') ? (value as IncorporationView) : null;
}

/**
 * The grid's empty message follows the real reason: no client is incorporating at all, the
 * "With" filter hides every row, or no client is at this view's steps yet.
 */
function emptyText(total: number, filtered: boolean, view: IncorporationView | null): string {
  if (total === 0) return 'No client is incorporating yet. A client appears here once its incorporation project starts.';
  if (filtered) return 'No client matches this filter';
  if (view === 'part-a') return 'No client is on a SPICe+ Part A step right now. A client appears here when it reaches Part A.';
  if (view === 'part-b') return 'No client is on a SPICe+ Part B step right now. A client appears here when it reaches Part B.';
  if (view === 'board-resolutions')
    return 'No client is at the board resolution steps right now. A client appears here when it reaches its board resolution.';
  return 'No client matches this filter';
}

/** Where a row opens in this view: the part's current step, the board resolution or the documents. */
function rowHrefFor(view: IncorporationView | null, c: PracticeIncorporationClient): string {
  const base = c.summary.href;
  if (view === 'documents') return `${base}/documents`;
  if (view === 'board-resolutions') return `${base}/board-resolution`;
  const stepId = c.summary.currentStep?.id;
  if ((view === 'part-a' || view === 'part-b') && stepId) return `${base}/step/${stepSlugForItemId(stepId)}`;
  return base;
}

/**
 * INCORPORATION on the admin, manager and lead shells (rule R-51, D-29; prototype
 * `src/screens/staff/IncorporationScreen.tsx`).
 *
 * The clients still incorporating, scoped to the role through `/api/practice/incorporation`
 * (a lead sees their own clients, a manager their team's, an admin all), never the super-only
 * insights. Four number tiles, then one grid with a "With" filter: Client, Current step,
 * Progress (PhaseBar), Steps, With, Days, Next, Status. Late rows are red, and a row opens the
 * client's record in this shell.
 *
 * Every number is real. Phase, current step, owner and status come from the checklist gate
 * (the same builder the super admin's Practice · Incorporation uses); days in step and the
 * step's due date come from the scoped practice metrics. The prototype's "With MCA" tile and
 * filter are left out: the app records no MCA-pending state, so "With manager" (a step waiting
 * on the manager's review) takes its place.
 */

type WithKey = PracticeWithKey;
const WITH_WORD = PRACTICE_WITH_WORD;
const stepCode = practiceStepCode;
const isLateRow = isLatePracticeRow;

export default function StaffPracticeIncorporation({ base }: { base: PracticeShellBase }) {
  const query = usePracticeIncorporation();
  const practiceQuery = usePracticeMetrics();
  const steps = practiceQuery.data?.currentStep;
  const [withWho, setWithWho] = useState<WithKey>('');
  const view = viewOf(useSearchParams()?.get('view') ?? null);
  const today = todayKey();
  const clientsHref = practiceClientsHref(base);

  const all = useMemo(() => incorporatingClients(query.data ?? []), [query.data]);
  const count = (w: Exclude<WithKey, ''>) => all.filter((c) => superOwnerOf(c.summary) === w).length;
  const late = all.filter((c) => isLateRow(c, steps?.[c.summary.id], today)).length;
  // The rows and their order are shared with the server's Excel export (GL-06).
  const rows = useMemo(() => practiceIncorporationRows(all, view, withWho), [all, withWho, view]);

  const seo = (
    <SEO
      title="Incorporation — VCFO Suite"
      description="Clients in incorporation: current step, progress, who holds it and status."
      path={`${base}/incorporation`}
    />
  );

  if (query.isError) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError title="Incorporation could not load" error={query.error} onRetry={() => void query.refetch()} />
      </PageTransition>
    );
  }

  const columns: EFilingColumn<PracticeIncorporationClient>[] = [
    {
      key: 'client',
      header: 'Client',
      width: '22%',
      render: (c) => (
        <span className="block max-w-[220px] truncate font-medium" title={c.summary.companyName}>
          {shortCompany(c.summary.companyName)}
        </span>
      ),
    },
    {
      key: 'step',
      header: 'Current step',
      width: '26%',
      render: (c) => {
        const code = stepCode(c.summary.currentStep?.id);
        return (
          <span className="flex min-w-0 items-center gap-2">
            {code ? <span className="flex-none font-mono text-[12px] text-ink-muted">{code}</span> : null}
            <span className="truncate">{c.summary.currentStep?.title ?? 'Every step is done'}</span>
          </span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Progress',
      width: '140px',
      render: (c) => {
        const track = superPhaseTrack(c.summary);
        return <PhaseBar done={track.done} totals={track.totals} names={track.names} className="w-28" />;
      },
    },
    {
      key: 'done',
      header: 'Steps',
      width: '76px',
      align: 'right',
      render: (c) => (
        <span className="tabular-nums">
          {c.summary.progress.done} / {c.summary.progress.total}
        </span>
      ),
    },
    {
      key: 'with',
      header: 'With',
      width: '88px',
      render: (c) => {
        const owner = superOwnerOf(c.summary);
        return owner ? WITH_WORD[owner] : <span className="text-ink-faint">–</span>;
      },
    },
    {
      key: 'days',
      header: 'Days',
      width: '64px',
      align: 'right',
      render: (c) => {
        const step = steps?.[c.summary.id];
        if (step?.days === null || step?.days === undefined) return <span className="text-ink-faint">–</span>;
        return (
          <span className={cn('tabular-nums', isLateRow(c, step, today) && 'font-medium text-danger')}>{step.days}</span>
        );
      },
    },
    {
      key: 'next',
      header: 'Next',
      width: '76px',
      render: (c) => {
        const next = steps?.[c.summary.id]?.dueOn ?? c.nextDueDate;
        return (
          <span className={cn('whitespace-nowrap tabular-nums', next && next < today && 'font-medium text-danger')}>
            {plainDay(next)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '124px',
      render: (c) => {
        const chip = superStateChip(c.summary);
        return (
          <Chip fixed tone={chip.tone} title={chip.title}>
            {chip.word}
          </Chip>
        );
      },
    },
  ];

  const loading = query.isPending;

  return (
    <PageTransition>
      {seo}
      <div className="flex flex-col gap-4">
        <SuperNumberStrip
          items={[
            { label: 'Clients incorporating', value: loading ? '–' : all.length },
            { label: 'Waiting on client', value: loading ? '–' : count('client') },
            { label: 'With manager', value: loading ? '–' : count('manager') },
            { label: 'Stuck or overdue', value: loading ? '–' : late, bad: late > 0 },
          ]}
        />
        <DashSection
          title={view ? `Incorporation · ${VIEW_TITLE[view]}` : 'Incorporation'}
          meta={loading ? undefined : String(rows.length)}
          headIcon={{ icon: Landmark, tone: 'blue' }}
          right={
            <>
              <SpectrumTabs
                label="With"
                value={withWho}
                onChange={(v) => setWithWho(v as WithKey)}
                items={[
                  { key: '', label: 'All', count: all.length },
                  { key: 'client', label: 'Client', count: count('client') },
                  { key: 'sbc', label: 'SBC', count: count('sbc') },
                  { key: 'manager', label: 'Manager', count: count('manager') },
                ]}
              />
              <ExportToExcelButton
                title={view ? `Incorporation · ${VIEW_TITLE[view]}` : 'Incorporation'}
                source={{ source: 'practice-incorporation', view, withWho }}
              />
            </>
          }
          flush
          bodyClassName="px-2 pb-2"
        >
          <EFilingGrid
            caption="Clients in incorporation"
            columns={columns}
            rows={rows}
            rowKey={(c) => c.summary.id}
            rowHref={(c) => rowHrefFor(view, c)}
            rowClassName={(c) => (isLateRow(c, steps?.[c.summary.id], today) ? 'text-danger' : undefined)}
            loading={loading}
            empty={emptyText(all.length, withWho !== '', view)}
            emptyAction={
              all.length === 0 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={clientsHref}>View clients</Link>
                </Button>
              ) : undefined
            }
            minWidth={960}
            pageSize={15}
          />
        </DashSection>
      </div>
    </PageTransition>
  );
}
