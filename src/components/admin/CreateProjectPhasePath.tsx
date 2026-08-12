'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Building2, Check, KeyRound, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  PHASE_MILESTONES,
  PHASE_ORDER,
  STAGE_LABEL,
  stagePhaseState,
  type Stage,
} from '@/components/admin/create-project-form-utils';

export type FormFlowSection = 'entity' | 'team' | 'client';

const FORM_STEPS: Array<{
  id: FormFlowSection;
  label: string;
  hint: string;
  icon: typeof Building2;
}> = [
  {
    id: 'entity',
    label: 'Entity details',
    hint: 'Parent, origin, legal form, start phase',
    icon: Building2,
  },
  {
    id: 'team',
    label: 'Team',
    hint: 'Project manager and project lead',
    icon: User,
  },
  {
    id: 'client',
    label: 'Client portal',
    hint: 'Sign-in email and initial password',
    icon: KeyRound,
  },
];

type FormFlowProps = {
  openSections: FormFlowSection[];
  sectionComplete: Record<FormFlowSection, boolean>;
  onSelect: (section: FormFlowSection) => void;
  /** compact = mobile top stepper; rail = fixed vertical desktop sidebar */
  variant?: 'compact' | 'rail';
  className?: string;
};

/** Form progress navigator — Entity → Team → Client (not delivery lifecycle). */
export function CreateProjectFormFlow({
  openSections,
  sectionComplete,
  onSelect,
  variant = 'rail',
  className,
}: FormFlowProps) {
  const readyCount = Object.values(sectionComplete).filter(Boolean).length;

  if (variant === 'compact') {
    return (
      <nav
        aria-label="Details to complete"
        className={cn(
          'rounded-xl border border-border/80 bg-gradient-to-b from-muted/35 to-background p-3',
          className,
        )}
      >
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="text-[11px] mono uppercase tracking-[0.16em] text-muted-foreground">
            Details to complete
          </p>
          <p className="text-[11px] text-muted-foreground">
            {readyCount} of {FORM_STEPS.length}
          </p>
        </div>
        <ol className="flex items-stretch gap-1.5">
          {FORM_STEPS.map((step, i) => {
            const done = sectionComplete[step.id];
            const active = openSections.includes(step.id);
            return (
              <li key={step.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'flex w-full flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 text-center transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active && 'border-orange-400/70 bg-orange-50/80',
                    !active && done && 'border-emerald-300/60 bg-emerald-50/45',
                    !active && !done && 'border-border/70 bg-background hover:bg-muted/40',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      done && 'bg-emerald-600 text-white',
                      !done && active && 'bg-orange-600 text-white',
                      !done && !active && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'text-[10.5px] font-medium leading-tight',
                      active ? 'text-orange-900' : done ? 'text-emerald-900' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <aside
      aria-label="Details to complete"
      className={cn(
        'flex h-full min-h-0 flex-col border-l border-border/60 bg-transparent pl-4 pr-1',
        className,
      )}
    >
      <div className="mb-6 shrink-0">
        <p className="text-[10px] mono uppercase tracking-[0.2em] text-muted-foreground">
          Progress
        </p>
        <p className="mt-2 text-[13px] font-medium tabular-nums text-foreground">
          {readyCount}
          <span className="font-normal text-muted-foreground"> / {FORM_STEPS.length}</span>
        </p>
        <div className="mt-3 h-px overflow-hidden bg-border/80">
          <div
            className="h-full bg-foreground/70 transition-[width] duration-500 ease-out"
            style={{ width: `${(readyCount / FORM_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="flex min-h-0 flex-1 flex-col">
        {FORM_STEPS.map((step, i) => {
          const done = sectionComplete[step.id];
          const active = openSections.includes(step.id);
          const isLast = i === FORM_STEPS.length - 1;
          const Icon = step.icon;
          return (
            <li key={step.id} className="relative flex min-h-0 flex-1 gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={active ? 'step' : undefined}
                  className={cn(
                    'relative z-[1] flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    done && 'border-emerald-600/40 bg-emerald-600 text-white',
                    !done && active && 'border-orange-600 bg-orange-600 text-white',
                    !done &&
                      !active &&
                      'border-border bg-background text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> : i + 1}
                </button>
                {!isLast ? (
                  <div
                    aria-hidden
                    className={cn(
                      'mt-1 w-px flex-1',
                      done ? 'bg-emerald-500/50' : 'bg-border',
                    )}
                  />
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className={cn(
                  'mb-5 flex min-w-0 flex-1 flex-col items-start justify-start pt-0.5 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md',
                  isLast && 'mb-0',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      active ? 'text-orange-700' : 'text-muted-foreground',
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'text-[13px] font-medium tracking-tight',
                      active && 'text-orange-900',
                      done && !active && 'text-foreground',
                      !done && !active && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </span>
                <span
                  className={cn(
                    'mt-1 text-[11px] leading-snug',
                    done ? 'text-emerald-700' : active ? 'text-orange-800/80' : 'text-muted-foreground/80',
                  )}
                >
                  {done ? 'Ready' : active ? 'In progress' : 'Up next'}
                </span>
                <span className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground/75">
                  {step.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

type PhasePickerProps = {
  stage: Stage;
  onChange: (stage: Stage) => void;
};

type PillRect = { left: number; top: number; width: number; height: number };

/**
 * Starting phase control inside Entity details.
 * One shared highlight slides between Incorporation / Registration / Compliance.
 */
export function CreateProjectStartingPhasePicker({ stage, onChange }: PhasePickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<PillRect | null>(null);
  const activeIndex = Math.max(0, PHASE_ORDER.indexOf(stage));

  const measurePill = () => {
    const track = trackRef.current;
    const btn = btnRefs.current[activeIndex];
    if (!track || !btn) return;
    const trackBox = track.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    setPill({
      left: btnBox.left - trackBox.left,
      top: btnBox.top - trackBox.top,
      width: btnBox.width,
      height: btnBox.height,
    });
  };

  useLayoutEffect(() => {
    measurePill();
  }, [activeIndex, stage]);

  useEffect(() => {
    const onResize = () => measurePill();
    window.addEventListener('resize', onResize);
    const ro =
      typeof ResizeObserver !== 'undefined' && trackRef.current
        ? new ResizeObserver(onResize)
        : null;
    if (trackRef.current && ro) ro.observe(trackRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [activeIndex]);

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3 sm:p-3.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-foreground">Where should work start?</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Prior phases are seeded as complete. Client checklist begins at your selection.
          </p>
        </div>
      </div>

      <div
        ref={trackRef}
        role="radiogroup"
        aria-label="Starting setup phase"
        className="relative mt-3 grid grid-cols-1 gap-1.5 rounded-lg bg-background p-1 ring-1 ring-border/80 sm:grid-cols-3"
      >
        {pill ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute z-0 rounded-md bg-orange-600 shadow-md"
            initial={false}
            animate={{
              left: pill.left,
              top: pill.top,
              width: pill.width,
              height: pill.height,
            }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 32,
              mass: 0.8,
            }}
          />
        ) : null}

        {PHASE_ORDER.map((p, i) => {
          const active = stage === p;
          const state = stagePhaseState(stage, p);
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              onClick={() => onChange(p)}
              className={cn(
                'relative z-[1] rounded-md px-2.5 py-2 text-left transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className="block text-[12.5px] font-semibold tracking-tight">
                {STAGE_LABEL[p]}
              </span>
              <span
                className={cn(
                  'mt-0.5 block text-[10px] leading-tight',
                  active ? 'text-orange-50/90' : 'text-muted-foreground',
                )}
              >
                {state === 'done'
                  ? 'Will mark prior'
                  : state === 'current'
                    ? 'Entry point'
                    : 'Comes later'}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">{STAGE_LABEL[stage]}</span>
        {' · '}
        {PHASE_MILESTONES[stage].slice(0, 3).join(' · ')}
      </p>
    </div>
  );
}

/** @deprecated Use CreateProjectFormFlow / CreateProjectStartingPhasePicker */
export function CreateProjectPhasePath(props: { stage: Stage; onChange: (stage: Stage) => void }) {
  return <CreateProjectStartingPhasePicker {...props} />;
}
