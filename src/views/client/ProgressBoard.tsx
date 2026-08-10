'use client';

import { useEffect, useMemo, useReducer } from 'react';
import { m } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import {
  Mono,
  ProgressRing,
  StatusDot,
  Surface,
  EmptyStateIllustrated,
  type DotTone,
} from '@/components/noir';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { fetchBoardResolutionInDb } from '@/lib/engagements-db';
import {
  boardResolutionProgressFromDoc,
  buildClientProgressPhases,
  CLIENT_PROGRESS_TONE_LABEL,
  overallClientProgressPercent,
  type ClientProgressTone,
} from '@/lib/client-progress-board';
import { fadeUp, staggerKids } from '@/lib/motion';
import { cn } from '@/lib/utils';

const TONE_DOT: Record<ClientProgressTone, DotTone> = {
  completed: 'success',
  'in-progress': 'warning',
  'not-started': 'danger',
};

const TONE_TEXT: Record<ClientProgressTone, string> = {
  completed: 'text-success',
  'in-progress': 'text-warning',
  'not-started': 'text-danger',
};

const LEGEND: Array<{ tone: ClientProgressTone }> = [
  { tone: 'completed' },
  { tone: 'in-progress' },
  { tone: 'not-started' },
];

function PhaseProgressBar({ percent, className }: { percent: number; className?: string }) {
  const v = Math.max(0, Math.min(100, percent));
  return (
    <progress
      value={v}
      max={100}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-border/80 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-border/80 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-gold [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-500 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-gold',
        className,
      )}
    />
  );
}

type BrProgressState = {
  loading: boolean;
  snapshot: ReturnType<typeof boardResolutionProgressFromDoc>;
};

type BrProgressAction =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'loaded'; doc: Awaited<ReturnType<typeof fetchBoardResolutionInDb>> | null };

function brProgressReducer(_state: BrProgressState, action: BrProgressAction): BrProgressState {
  switch (action.type) {
    case 'idle':
      return { loading: false, snapshot: boardResolutionProgressFromDoc(null) };
    case 'loading':
      return { loading: true, snapshot: boardResolutionProgressFromDoc(null) };
    case 'loaded':
      return { loading: false, snapshot: boardResolutionProgressFromDoc(action.doc) };
    default:
      return { loading: false, snapshot: boardResolutionProgressFromDoc(null) };
  }
}

export default function ClientProgressBoard() {
  const { user, engagements, getStateForEngagement, refreshEngagementChecklist, engagementsLoading } =
    useApp();
  const engagement = useMemo(
    () => (user ? findEngagementForClientUser(engagements, user) : undefined),
    [engagements, user],
  );

  const checklistState = useMemo(
    () => (engagement ? getStateForEngagement(engagement) : {}),
    [engagement, getStateForEngagement],
  );

  const [brProgress, dispatchBrProgress] = useReducer(brProgressReducer, {
    loading: true,
    snapshot: boardResolutionProgressFromDoc(null),
  });

  useEffect(() => {
    if (!engagement?.id) return;
    void refreshEngagementChecklist(engagement.id);
    let cancelled = false;
    dispatchBrProgress({ type: 'loading' });
    void fetchBoardResolutionInDb(engagement.id)
      .then((doc) => {
        if (!cancelled) dispatchBrProgress({ type: 'loaded', doc });
      })
      .catch(() => {
        if (!cancelled) dispatchBrProgress({ type: 'loaded', doc: null });
      });
    return () => {
      cancelled = true;
    };
  }, [engagement?.id, refreshEngagementChecklist]);

  const { snapshot: brSnapshot, loading: brLoading } = brProgress;

  const phases = useMemo(
    () => buildClientProgressPhases(checklistState, brSnapshot),
    [checklistState, brSnapshot],
  );

  const overallPct = overallClientProgressPercent(phases);

  if (!user || user.role !== 'client') return null;

  if (!engagement && !engagementsLoading) {
    return (
      <EmptyStateIllustrated
        title="No active engagement"
        description="We could not find an incorporation project linked to your account."
      />
    );
  }

  if (!engagement) {
    return (
      <PageTransition>
        <p className="text-[13px] text-text-tertiary">Loading your project…</p>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <SEO
        title="Progress board — VCFO Suite"
        description="See pre-incorporation progress across name application and incorporation details in one view."
        path="/app/client/progress"
      />

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-start gap-5 min-w-0">
          <ProgressRing value={overallPct} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="serif text-[28px] sm:text-[32px] tracking-tight text-ink">
              Progress
            </h1>
            <p className="text-[13px] text-text-tertiary mt-1 truncate">
              {engagement.companyName} · {engagement.stage}
            </p>
            {brLoading && (
              <p className="text-[11px] text-text-tertiary mt-2 mono">Syncing board resolution status…</p>
            )}
          </div>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-text-tertiary">
        {LEGEND.map((entry) => (
          <span key={entry.tone} className="inline-flex items-center gap-1.5">
            <StatusDot tone={TONE_DOT[entry.tone]} size={8} />
            <span className={cn('font-medium', TONE_TEXT[entry.tone])}>
              {CLIENT_PROGRESS_TONE_LABEL[entry.tone]}
            </span>
          </span>
        ))}
      </div>

      <m.div
        variants={staggerKids(0.06)}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {phases.map((phase) => (
          <m.section key={phase.id} variants={fadeUp}>
            <Surface className="overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-border/80">
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h2 className="serif text-[20px] sm:text-[22px] text-ink leading-tight">
                      {phase.title}
                    </h2>
                    <p className="text-[12px] text-text-tertiary mt-1 tabular-nums">
                      {phase.completedCount} of {phase.totalCount} steps completed
                    </p>
                  </div>
                  <Mono className="text-[11px] text-role tabular-nums shrink-0">
                    {phase.progressPercent}%
                  </Mono>
                </div>
                <PhaseProgressBar percent={phase.progressPercent} />
              </div>

              <ul className="divide-y divide-border/80">
                {phase.steps.map((step) => (
                  <li
                    key={step.itemId}
                    className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4"
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono tabular-nums',
                        step.tone === 'completed'
                          ? 'border-success/40 bg-success/10 text-success'
                          : step.tone === 'in-progress'
                            ? 'border-warning/40 bg-warning/10 text-warning'
                            : 'border-danger/30 bg-danger/5 text-danger',
                      )}
                      aria-hidden
                    >
                      {step.stepNumber}
                    </span>
                    <StatusDot
                      tone={TONE_DOT[step.tone]}
                      size={8}
                      pulse={step.tone === 'in-progress'}
                      className="mt-2 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] sm:text-[14px] text-ink leading-snug">{step.title}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 pt-0.5">
                      <span
                        className={cn(
                          'text-[10px] mono uppercase tracking-[0.12em]',
                          TONE_TEXT[step.tone],
                        )}
                      >
                        {CLIENT_PROGRESS_TONE_LABEL[step.tone]}
                      </span>
                      <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                        · {step.timelineLabel}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Surface>
          </m.section>
        ))}
      </m.div>

      <p className="text-[11px] text-text-tertiary mt-6 max-w-prose leading-relaxed">
        This board is read-only. Use{' '}
        <span className="text-ink">Incorporation</span> to submit forms and{' '}
        <span className="text-ink">Board Resolution</span> to download or upload signed documents.
      </p>
    </PageTransition>
  );
}
