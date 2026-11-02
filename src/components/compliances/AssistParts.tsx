'use client';

/**
 * VCFO Assist on the compliance records (migration 0029; C-324, C-363, C-377, S-773, S-809).
 * VCFO Assist is the browser extension (`../vcfo_assist`) that fills a government portal form
 * from VCFO data, one page at a time, keeping a screenshot of each. Suite stores its run state
 * per filing period or registration; these parts read it.
 *  - `AssistChip`: the 104px state chip (Filings column).
 *  - `AssistPanelBlock`: the "VCFO Assist" block of the client filing dialog and side panel.
 *  - `AssistCard`: the staff "File with VCFO Assist" card with "Start filing" and the replay.
 * While `VCFO_ASSIST_ENABLED` is off the parts say "Not set up"; nothing is ever simulated.
 */
import { useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { AssistSteps, type AssistStepRow } from '@/components/dash/assist-steps';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { assistWord, stepNote, stepsToShow, type AssistRunDto, type AssistSubjectKind } from '@/lib/assist-runs/runs';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { assistShotHref, useAssistRuns, useStartAssist } from './use-compliance-records';

export function AssistChip({ run, setUp = true, className }: { run: AssistRunDto | null | undefined; setUp?: boolean; className?: string }) {
  const w = assistWord(run, setUp);
  return (
    <Chip tone={w.tone} fixed className={className} raw>
      {w.label}
    </Chip>
  );
}

function rowsOf(run: AssistRunDto | null, portal: string, form: string | null): AssistStepRow[] {
  const short = portal.split(' ')[0] ?? portal;
  return stepsToShow(run, portal, form).map((s, i) => ({
    id: `${i}`,
    title: s.title,
    state: run?.state === 'failed' && s.state === 'run' ? 'failed' : s.state,
    note: run?.state === 'failed' && s.state === 'run' ? (run.error ?? 'Stopped') : stepNote(s),
    ...(s.shot && run ? { shot: `${short} · p${i + 1}`, shotHref: assistShotHref(run.id, i) } : {}),
  }));
}

function shotsOf(run: AssistRunDto | null): Array<{ i: number; title: string }> {
  return run ? run.steps.map((s, i) => ({ i, title: s.title, shot: s.shot })).filter((s) => s.shot) : [];
}

/** The screenshots of a run as a grid of links (the replay). */
function ReplayGrid({ run, className }: { run: AssistRunDto; className?: string }) {
  const shots = shotsOf(run);
  if (!shots.length) return <p className="text-[13px] text-ink-faint">No screenshots kept</p>;
  return (
    <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      {shots.map((s) => (
        <li key={s.i} className="grid min-w-0 gap-1.5">
          <a href={assistShotHref(run.id, s.i)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border-1.5 border-line bg-surface-sunken hover:border-line-strong">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin screenshot behind auth, not an optimisable asset */}
            <img src={assistShotHref(run.id, s.i)} alt={`Page ${s.i + 1}: ${s.title}`} className="aspect-[4/3] w-full object-cover object-top" loading="lazy" />
          </a>
          <span className="truncate text-[12.5px] text-ink-2">{s.title}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Client filing dialog and side panel block (C-324, C-377): the heading, the state chip,
 * "View replay" once the run kept screenshots, and the steps.
 */
export function AssistPanelBlock({
  kind = 'filing',
  subjectKey,
  portal,
  form,
  engagementId,
}: {
  kind?: AssistSubjectKind;
  subjectKey: string;
  portal: string;
  form: string | null;
  engagementId?: string | null;
}) {
  const q = useAssistRuns({ engagementId, kind, key: subjectKey });
  const [replay, setReplay] = useState(false);
  const run = q.data?.runs[0] ?? null;
  const setUp = q.data?.setUp ?? true;
  const shots = shotsOf(run).length;
  return (
    <div className="pb-2" aria-label="VCFO Assist">
      <div className="flex items-center gap-2 px-5 pt-4">
        <h3 className="text-[12.5px] font-medium text-ink-muted">VCFO Assist</h3>
        {q.isLoading ? null : <AssistChip run={run} setUp={setUp} />}
        {shots && run ? (
          <button type="button" className="ml-auto text-[12.5px] font-medium text-brand-text hover:underline" aria-expanded={replay} onClick={() => setReplay((v) => !v)}>
            {replay ? 'Hide replay' : 'View replay'}
          </button>
        ) : null}
      </div>
      {q.isLoading ? (
        <div className="px-5 pt-2">
          <SkeletonRows rows={2} />
        </div>
      ) : q.isError ? (
        <p className="px-5 pt-2 text-[13px] text-ink-faint">Could not load VCFO Assist</p>
      ) : setUp ? (
        <>
          <AssistSteps steps={rowsOf(run, portal, form)} className="mt-2" />
          {replay && run ? <ReplayGrid run={run} className="px-5 pt-2" /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Staff "File with VCFO Assist" (S-773, S-809): the steps, "Start filing" (a requested run the
 * extension picks up in the lead's browser), and "View replay" with the kept screenshots.
 */
export function AssistCard({
  engagementId,
  kind,
  subjectKey,
  portal,
  form,
  mayStart,
}: {
  engagementId: string;
  kind: AssistSubjectKind;
  subjectKey: string;
  portal: string;
  form: string | null;
  mayStart: boolean;
}) {
  const q = useAssistRuns({ engagementId, kind, key: subjectKey });
  const start = useStartAssist();
  const [replay, setReplay] = useState(false);
  const run = q.data?.runs[0] ?? null;
  const setUp = q.data?.setUp ?? true;
  const open = run && (run.state === 'requested' || run.state === 'running' || run.state === 'paused');
  const shots = shotsOf(run).length;

  const right = !setUp ? (
    <AssistChip run={null} setUp={false} />
  ) : shots && run && !open ? (
    <Button size="sm" variant="secondary" onClick={() => setReplay(true)}>
      View replay
    </Button>
  ) : mayStart ? (
    <Button
      size="sm"
      disabled={Boolean(open) || start.isPending || q.isLoading}
      onClick={() =>
        start.mutate(
          { engagementId, kind, key: subjectKey, form },
          { onError: (e) => toastError('Could not start VCFO Assist', errorMessage(e)) },
        )
      }
    >
      {start.isPending || run?.state === 'running' ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Play aria-hidden />}
      {run?.state === 'requested' ? 'Requested' : run?.state === 'running' ? 'Filing' : run?.state === 'paused' ? 'Needs you' : 'Start filing'}
    </Button>
  ) : (
    <AssistChip run={run} />
  );

  return (
    <DashSection title="File with VCFO Assist" meta={setUp && run ? assistWord(run).label : undefined} right={right} bodyClassName="p-0">
      {q.isLoading ? (
        <div className="p-4">
          <SkeletonRows rows={3} />
        </div>
      ) : q.isError ? (
        <p className="px-4 py-3 text-[13px] text-ink-faint">Could not load VCFO Assist</p>
      ) : !setUp ? (
        <EmptyState title="VCFO Assist is not set up" className="m-4" />
      ) : (
        <>
          <AssistSteps steps={rowsOf(run, portal, form)} />
          {run?.reference || shots ? (
            <p className="border-t border-line-soft px-4 py-2.5 text-[13px] text-ink-muted md:px-5">
              {run?.reference ? (
                <>
                  Reference <span className="font-mono text-ink">{run.reference}</span>
                  {shots ? ' · ' : ''}
                </>
              ) : null}
              {shots ? `Replay kept · ${shots} ${shots === 1 ? 'screenshot' : 'screenshots'}` : ''}
            </p>
          ) : null}
        </>
      )}
      {run ? (
        <Modal open={replay} onOpenChange={setReplay} title="VCFO Assist replay" sub={`${run.form ?? form ?? 'Form'} · ${shots} ${shots === 1 ? 'screenshot' : 'screenshots'}`} size="lg">
          <ReplayGrid run={run} />
        </Modal>
      ) : null}
    </DashSection>
  );
}
