'use client';

import { Check } from 'lucide-react';
import type { Bucket, ChecklistItem } from '@/data/checklist';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { getStepGate } from '@/lib/checklist-step-gate';
import { cn } from '@/lib/utils';

export type InternRailNodeKind = 'done' | 'current' | 'locked';

export type InternRailPhaseInput = {
  id: string;
  title: string;
  items: readonly ChecklistItem[];
};

export type InternRailGroup = {
  bucket: Bucket;
  label: string;
  phases: readonly InternRailPhaseInput[];
};

type InternProgressRailProps = {
  groups: readonly InternRailGroup[];
  gates: Record<string, ChecklistStepGate>;
  openBuckets: readonly Bucket[];
  currentPhaseId: string | null;
  onToggleBucket: (bucket: Bucket) => void;
  onSelectPhase: (bucket: Bucket, phaseId: string) => void;
  variant?: 'rail' | 'compact';
  className?: string;
};

export function internPhaseRailLabel(phaseId: string, title: string): string {
  switch (phaseId) {
    case 'pre-inc-phase-1':
      return 'Name Application';
    case 'pre-inc-phase-2':
      return 'Incorporation Details';
    case 'post-inc-phase-3':
      return 'Post-incorporation';
    case 'registration-phase-4':
      return 'Registration';
    default:
      return title.replace(/^Phase\s+\d+\s+[—–-]\s+/i, '').trim() || title;
  }
}

export function internNodeKind(
  items: readonly { id: string }[],
  gates: Record<string, ChecklistStepGate>,
): InternRailNodeKind {
  if (items.length === 0) return 'locked';
  let allDone = true;
  let hasCurrent = false;
  for (const item of items) {
    const kind = getStepGate(gates, item.id).kind;
    if (kind === 'active' || kind === 'waiting') hasCurrent = true;
    if (kind !== 'done') allDone = false;
  }
  if (allDone) return 'done';
  if (hasCurrent) return 'current';
  return 'locked';
}

/** Equal-weight phase average so in-progress work fills the bar (not 0% until a phase is fully done). */
export function internWeightedProgress(
  groups: readonly InternRailGroup[],
  gates: Record<string, ChecklistStepGate>,
): number {
  const phases = groups.flatMap((group) => group.phases);
  if (phases.length === 0) return 0;
  let sum = 0;
  for (const phase of phases) {
    const total = phase.items.length;
    if (!total) continue;
    const done = phase.items.filter((item) => getStepGate(gates, item.id).kind === 'done').length;
    sum += done / total;
  }
  return (sum / phases.length) * 100;
}

function StatusGlyph({ kind }: { kind: InternRailNodeKind }) {
  if (kind === 'done') {
    return (
      <Check
        className="h-3 w-3 shrink-0 text-success"
        strokeWidth={2.75}
        aria-hidden
      />
    );
  }
  if (kind === 'current') {
    return (
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center"
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
    );
  }
  return (
    <span
      className="flex h-3 w-3 shrink-0 items-center justify-center"
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full border border-border" />
    </span>
  );
}

function nodeLabel(kind: InternRailNodeKind): string {
  if (kind === 'done') return 'Complete';
  if (kind === 'current') return 'Current';
  return 'Upcoming';
}

export function InternProgressRail({
  groups,
  gates,
  openBuckets,
  currentPhaseId,
  onToggleBucket,
  onSelectPhase,
  variant = 'rail',
  className,
}: InternProgressRailProps) {
  const percent = internWeightedProgress(groups, gates);
  const compact = variant === 'compact';
  const rounded = Math.round(percent);

  return (
    <nav
      aria-label="Project progress"
      className={cn(
        compact
          ? 'rounded-xl border border-border/80 bg-background px-3 py-3'
          : cn(
              'flex h-full min-h-0 flex-col rounded-2xl border border-border/70 bg-background',
              'px-4 py-5',
            ),
        className,
      )}
    >
      <div className={cn('shrink-0', compact ? 'mb-3' : 'mb-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Progress
          </p>
          <p className="text-[11px] tabular-nums text-muted-foreground">{rounded}%</p>
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-label="Project progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>

      <ol className={cn('space-y-1', !compact && 'min-h-0 flex-1 overflow-y-auto')}>
        {groups.map((group) => {
          const bucketKind = internNodeKind(
            group.phases.flatMap((phase) => phase.items),
            gates,
          );
          const open = openBuckets.includes(group.bucket);

          return (
            <li key={group.bucket}>
              <button
                type="button"
                onClick={() => onToggleBucket(group.bucket)}
                aria-expanded={open}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md py-1.5 text-left transition-colors',
                  'hover:bg-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                )}
              >
                <span title={nodeLabel(bucketKind)}>
                  <StatusGlyph kind={bucketKind} />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12.5px] font-medium tracking-tight',
                    bucketKind === 'locked' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {group.label}
                </span>
              </button>

              {open ? (
                <ol className="ml-[5px] border-l border-border/80 py-0.5 pl-3">
                  {group.phases.map((phase) => {
                    const kind = internNodeKind(phase.items, gates);
                    const current = phase.id === currentPhaseId;
                    return (
                      <li key={phase.id}>
                        <button
                          type="button"
                          onClick={() => onSelectPhase(group.bucket, phase.id)}
                          aria-current={current ? 'step' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md py-1.5 pl-1.5 pr-1 text-left transition-colors',
                            'hover:bg-raised/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                            current && 'bg-primary-light/70',
                          )}
                        >
                          <span title={nodeLabel(kind)}>
                            <StatusGlyph kind={kind} />
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[12px] leading-snug',
                              current
                                ? 'font-medium text-primary'
                                : kind === 'locked'
                                  ? 'text-muted-foreground'
                                  : 'text-foreground/85',
                            )}
                          >
                            {internPhaseRailLabel(phase.id, phase.title)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
