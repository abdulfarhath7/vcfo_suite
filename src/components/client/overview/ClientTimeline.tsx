'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Info, Pencil, Redo2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientOverviewMilestone, ClientOverviewTeamMember } from '@/lib/client-overview';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import type { ChecklistGateViewer } from '@/lib/checklist-step-gate';
import type { EngagementSchedule } from '@/lib/schedule-windows';
import {
  buildClientTimeline,
  labelForDayOffset,
  shiftPhases,
  timelineStatusWord,
  timelineStepsFromState,
  type PhaseSpan,
  type TimelineBarView,
  type TimelineInputStep,
  type TimelineModel,
  type TimelineTone,
} from '@/lib/client-timeline';
import { TIMELINE_TONE as TONE, TimelineChart } from '@/components/client/overview/TimelineChart';

/**
 * Home timeline, laid out like the client-portal prototype:
 * a date ruler, one bar per phase, a today line, and a request
 * to move the dates. Colours stay in ink, sage, and bronze.
 */

const CHIP: Record<TimelineTone, string> = {
  done: 'bg-[oklch(94%_0.02_168)] text-[oklch(32%_0.04_168)]',
  current: 'bg-[oklch(94%_0.012_255)] text-[oklch(28%_0.03_255)]',
  waiting: 'bg-[oklch(95%_0.02_80)] text-[oklch(38%_0.05_70)]',
  upcoming: 'bg-muted text-muted-foreground',
};

interface PendingRequest {
  reason: string;
  spans: { id: string; start: number; end: number }[];
}

function storageKey(engagementId: string): string {
  return `vcfo.timeline.pending.${engagementId}`;
}

function readPending(engagementId: string): PendingRequest | null {
  try {
    const raw = sessionStorage.getItem(storageKey(engagementId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRequest;
    if (!parsed?.reason || !Array.isArray(parsed.spans)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ClientTimeline({
  engagementId,
  startDate,
  milestones,
  steps,
  schedule,
  team,
  managerName,
  allowRequest = true,
}: {
  engagementId: string;
  startDate?: string | null;
  milestones?: ClientOverviewMilestone[];
  steps?: TimelineInputStep[];
  schedule?: EngagementSchedule | null;
  team?: ClientOverviewTeamMember[];
  managerName?: string;
  /** Client home can propose a move. Staff pages only read the schedule. */
  allowRequest?: boolean;
}) {
  const inputSteps = useMemo(() => {
    if (steps) return steps;
    return (milestones ?? []).map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      kind: milestone.kind,
      completedOn: milestone.completedOn,
    }));
  }, [milestones, steps]);
  const model = useMemo(
    () =>
      buildClientTimeline({
        startDate,
        schedule,
        steps: inputSteps,
      }),
    [inputSteps, schedule, startDate],
  );
  const manager = managerName ?? team?.find((member) => member.role === 'Project Manager')?.name;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [hint, setHint] = useState(false);
  const hintId = useId();

  useEffect(() => {
    setPending(readPending(engagementId));
  }, [engagementId]);

  const bars = model.bars.map((bar) => {
    const proposal = allowRequest ? pending?.spans.find((span) => span.id === bar.id) : undefined;
    if (!proposal) return bar;
    return {
      ...bar,
      startDay: proposal.start,
      endDay: proposal.end,
      rangeLabel: labelForDayOffset(model.axisStart, proposal.start, proposal.end, bar.milestone),
    };
  });
  const expandedBar = bars.find((bar) => bar.id === expanded) ?? null;

  return (
    <section className="surface min-w-0 overflow-hidden" aria-label="Timeline">
      <div className="flex min-w-0 items-center gap-2 border-b border-foreground/10 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-foreground">Timeline</h2>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:text-foreground"
          aria-expanded={hint}
          aria-controls={hintId}
          onClick={() => setHint((value) => !value)}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">About this timeline</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {allowRequest && pending ? (
            <span className="rounded px-2 py-0.5 text-[11px] font-semibold text-[oklch(38%_0.05_70)] bg-[oklch(95%_0.02_80)]">
              Request saved on this device
            </span>
          ) : (
            <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', CHIP[headlineTone(model)])}>
              {model.headline}
            </span>
          )}
          {allowRequest ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-semibold text-foreground hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Request a change
            </button>
          ) : null}
        </div>
      </div>

      {hint ? (
        <p id={hintId} className="px-4 pt-2 text-[12px] leading-snug text-muted-foreground">
          Drag the chart, swipe, or shift + scroll to move through the months; ctrl + scroll or − / + to
          zoom. Completed phases stay locked. A bar says “Not set” until a date is on the schedule.
          {allowRequest
            ? ' A saved request stays on this device until the schedule is updated.'
            : null}
        </p>
      ) : null}

      <div className="px-4 pb-4 pt-3">
        <TimelineChart
          model={model}
          bars={bars}
          expanded={expanded}
          onToggle={(barId) => setExpanded((current) => (current === barId ? null : barId))}
        />

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
          <Legend swatch="bg-[oklch(40%_0.045_168)]" label="Completed" />
          <Legend swatch="bg-[oklch(30%_0.028_255)]" label="In progress" />
          <Legend swatch="bg-[oklch(46%_0.055_78)]" label="Waiting for you" />
          <Legend swatch="border border-dashed border-[oklch(70%_0.012_255)]" label="Not set" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-[oklch(58%_0.08_85)]" />
            {model.todayLabel}
          </span>
        </div>
        {model.sharedNote ? (
          <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{model.sharedNote}</p>
        ) : null}

        {expandedBar ? <StepList bar={expandedBar} /> : null}
      </div>

      {allowRequest && open ? (
        <TimelineEditor
          model={model}
          manager={manager}
          pending={pending}
          onClose={() => setOpen(false)}
          onSave={(next) => {
            sessionStorage.setItem(storageKey(engagementId), JSON.stringify(next));
            setPending(next);
            setOpen(false);
          }}
          onClear={() => {
            sessionStorage.removeItem(storageKey(engagementId));
            setPending(null);
            setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

/** The same chart on a project page. Staff read it; only a client can request a move. */
export function ProjectTimeline({
  engagementId,
  startDate,
  schedule,
  state,
  viewer,
  allowRequest = false,
  managerName,
}: {
  engagementId: string;
  startDate?: string | null;
  schedule?: EngagementSchedule | null;
  state: Record<string, ChecklistItemStateSlice | undefined>;
  viewer: ChecklistGateViewer;
  allowRequest?: boolean;
  managerName?: string;
}) {
  const steps = useMemo(() => timelineStepsFromState(state, viewer), [state, viewer]);
  return (
    <ClientTimeline
      engagementId={engagementId}
      startDate={startDate}
      steps={steps}
      schedule={schedule}
      allowRequest={allowRequest}
      managerName={managerName}
    />
  );
}

function headlineTone(model: TimelineModel): TimelineTone {
  if (model.headline === 'Completed') return 'done';
  if (model.headline === 'Waiting for you') return 'waiting';
  return 'current';
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-4 rounded-[2px]', swatch)} />
      {label}
    </span>
  );
}

function StepList({ bar }: { bar: TimelineBarView }) {
  return (
    <ul className="mt-3 divide-y divide-border border-t border-border">
      {bar.steps.map((step) => (
        <li key={step.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2">
          <span className="truncate text-[12.5px] font-medium text-foreground">{step.title}</span>
          <span className="font-mono text-[11.5px] text-muted-foreground">{step.dateLabel}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10.5px] font-semibold', CHIP[step.tone])}>
            {timelineStatusWord(step.tone)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TimelineEditor({
  model,
  manager,
  pending,
  onClose,
  onSave,
  onClear,
}: {
  model: TimelineModel;
  manager?: string;
  pending: PendingRequest | null;
  onClose: () => void;
  onSave: (next: PendingRequest) => void;
  onClear: () => void;
}) {
  const initial = useMemo<PhaseSpan[]>(
    () =>
      model.bars.map((bar) => {
        const saved = pending?.spans.find((span) => span.id === bar.id);
        return {
          start: saved?.start ?? bar.startDay,
          end: saved?.end ?? bar.endDay,
          locked: bar.locked,
          milestone: bar.milestone,
        };
      }),
    [model.bars, pending],
  );
  const [spans, setSpans] = useState(initial);
  const [history, setHistory] = useState<PhaseSpan[][]>([]);
  const [future, setFuture] = useState<PhaseSpan[][]>([]);
  const [snap, setSnap] = useState<1 | 7>(1);
  const [reason, setReason] = useState(pending?.reason ?? '');
  const [error, setError] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function undo() {
    setHistory((stack) => {
      const previous = stack[stack.length - 1];
      if (!previous) return stack;
      setFuture((ahead) => [spans, ...ahead]);
      setSpans(previous);
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setFuture((ahead) => {
      const next = ahead[0];
      if (!next) return ahead;
      setHistory((stack) => [...stack, spans]);
      setSpans(next);
      return ahead.slice(1);
    });
  }

  function onPointerDown(
    event: React.PointerEvent<HTMLElement>,
    index: number,
    edge: 'move' | 'start' | 'end',
  ) {
    const bar = spans[index];
    if (!bar || bar.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const lane = event.currentTarget.closest('[data-lane]');
    const handle = event.currentTarget;
    if (!(lane instanceof HTMLElement)) return;
    const originX = event.clientX;
    const origin = spans.map((span) => ({ ...span }));
    let moved = false;
    handle.setPointerCapture(event.pointerId);

    const move = (ev: PointerEvent) => {
      const rect = lane.getBoundingClientRect();
      if (rect.width <= 0) return;
      const px = rect.width / model.spanDays;
      const base = origin[index]!;
      let start: number;
      let end: number;
      if (edge === 'move' && base.milestone) {
        const day = Math.round((ev.clientX - rect.left) / px / snap) * snap;
        start = day;
        end = day;
      } else {
        const delta = Math.round((ev.clientX - originX) / px / snap) * snap;
        if (!delta) return;
        start = edge === 'end' ? base.start : base.start + delta;
        end = edge === 'start' ? base.end : base.end + delta;
      }
      const next = shiftPhases(origin, index, start, end, edge, model.spanDays);
      if (next[index]?.start === origin[index]?.start && next[index]?.end === origin[index]?.end) return;
      moved = true;
      setSpans(next);
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      if (moved) setHistory((stack) => [...stack, origin]);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  }

  const changed = spans.some((span, index) => {
    const bar = model.bars[index];
    return bar && (span.start !== bar.startDay || span.end !== bar.endDay);
  });
  const coi = spans[spans.length - 1];
  const coiWas = model.bars[model.bars.length - 1];
  const slip = coi && coiWas ? coi.start - coiWas.startDay : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop as a real button: click-outside closes, and it stays reachable
          from the keyboard instead of being a click handler on a plain div. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[oklch(22%_0.03_255/0.28)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-request-title"
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[920px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_60px_-24px_oklch(20%_0.03_255/0.45)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 id="timeline-request-title" className="text-[15px] font-semibold text-foreground">
            Request a timeline change
          </h2>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          <p className="mb-3 rounded-md border border-[oklch(80%_0.02_255)] bg-[oklch(97%_0.006_255)] px-3 py-2 text-[12.5px] text-foreground dark:bg-muted">
            Saving keeps this proposal on this device. It does not change the dates.
            {manager ? ` ${manager} updates the schedule.` : ' Your project manager updates the schedule.'}
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={undo} disabled={history.length === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40" aria-label="Undo">
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={redo} disabled={future.length === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40" aria-label="Redo">
              <Redo2 className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-[11.5px] font-semibold text-muted-foreground">Snap</span>
            <div className="inline-flex rounded-full bg-muted/70 p-1">
              {([1, 7] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={snap === value}
                  onClick={() => setSnap(value)}
                  className={cn(
                    'h-8 rounded-full px-3 text-[13px] font-medium transition-colors duration-200',
                    snap === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {value === 1 ? 'Day' : 'Week'}
                </button>
              ))}
            </div>
            {slip !== 0 ? (
              <span className="ml-auto rounded bg-[oklch(95%_0.02_80)] px-2 py-0.5 text-[11px] font-semibold text-[oklch(38%_0.05_70)]">
                COI would move {slip > 0 ? '+' : ''}
                {slip} {Math.abs(slip) === 1 ? 'day' : 'days'}
              </span>
            ) : null}
          </div>

          <div ref={trackRef} className="rounded-lg border border-border px-3 py-2">
            {model.bars.map((bar, index) => {
              const span = spans[index]!;
              const left = (span.start / model.spanDays) * 100;
              const width = bar.milestone ? 1.6 : Math.max(2.2, ((span.end - span.start) / model.spanDays) * 100);
              const beforeLeft = (bar.startDay / model.spanDays) * 100;
              const beforeWidth = bar.milestone
                ? 1.6
                : Math.max(2.2, ((bar.endDay - bar.startDay) / model.spanDays) * 100);
              const moved = span.start !== bar.startDay || span.end !== bar.endDay;
              const when =
                moved || bar.from
                  ? labelForDayOffset(model.axisStart, span.start, span.end, bar.milestone)
                  : 'Not set';
              return (
                <div key={bar.id} className="grid grid-cols-[168px_minmax(0,1fr)] items-center">
                  <span className="pr-2 text-[12px] font-semibold leading-tight text-foreground">{bar.label}</span>
                  <div data-lane className="relative h-10">
                    {moved ? (
                      <span
                        className="absolute top-[11px] h-[18px] rounded-[4px] border border-dashed border-[oklch(62%_0.015_255)]"
                        style={{ left: `${beforeLeft}%`, width: `${beforeWidth}%` }}
                      />
                    ) : null}
                    <span
                      className="absolute top-[11px] h-[18px]"
                      style={
                        bar.milestone
                          ? { left: `calc(${left}% - 10px)`, width: '20px' }
                          : { left: `${left}%`, width: `${width}%` }
                      }
                    >
                      <button
                        type="button"
                        disabled={bar.locked}
                        aria-label={`${bar.label}, ${when}`}
                        onPointerDown={(event) => onPointerDown(event, index, 'move')}
                        className={cn(
                          'absolute inset-0 rounded-[4px]',
                          TONE[bar.tone],
                          bar.locked ? 'cursor-not-allowed opacity-80' : 'cursor-grab active:cursor-grabbing',
                        )}
                      />
                      {bar.locked || bar.milestone ? null : (
                        <>
                          <span
                            role="presentation"
                            className="absolute -left-1.5 top-1/2 z-10 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-background shadow-[0_1px_4px_rgba(15,23,42,0.16)] ring-1 ring-foreground/10"
                            onPointerDown={(event) => onPointerDown(event, index, 'start')}
                          />
                          <span
                            role="presentation"
                            className="absolute -right-1.5 top-1/2 z-10 h-5 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-background shadow-[0_1px_4px_rgba(15,23,42,0.16)] ring-1 ring-foreground/10"
                            onPointerDown={(event) => onPointerDown(event, index, 'end')}
                          />
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Drag a bar to move it, or drag either end to change its length. Day moves one day at a time.
            Week moves seven. Completed phases stay locked.
          </p>

          <div className="mt-4">
            <label htmlFor="timeline-reason" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reason for the change
            </label>
            <textarea
              id="timeline-reason"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(false);
              }}
              className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground"
              placeholder="For example: the office letter will arrive next week."
            />
            {error ? (
              <p className="mt-1 text-[12px] text-[oklch(42%_0.08_25)]">Add a short reason so the request can be reviewed.</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-4 py-3">
          {pending ? (
            <button type="button" onClick={onClear} className="mr-auto text-[12.5px] font-semibold text-muted-foreground">
              Clear saved request
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-border bg-background px-3 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            type="button"
            disabled={!changed && !pending}
            onClick={() => {
              if (!reason.trim()) {
                setError(true);
                return;
              }
              onSave({
                reason: reason.trim(),
                spans: model.bars.map((bar, index) => ({
                  id: bar.id,
                  start: spans[index]!.start,
                  end: spans[index]!.end,
                })),
              });
            }}
            className="h-9 rounded-md bg-[oklch(27%_0.03_255)] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Save request
          </button>
        </div>
      </div>
    </div>
  );
}
