'use client';

import { Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ChecklistItem, StatusCode } from '@/data/checklist';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import { ChecklistClientFlow } from '@/components/incorporation/ChecklistClientFlow';
import { ChecklistStepCanvas } from '@/components/incorporation/ChecklistStepCanvas';
import { PhaseCelebration } from '@/components/incorporation/PhaseCelebration';
import { YourTurnBanner } from '@/components/incorporation/YourTurnBanner';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { GeometricEmpty } from '@/components/illustrations/GeometricEmpty';
import { useApp } from '@/context/AppContext';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { gateDisplayStatus } from '@/lib/checklist-step-gate';
import { phaseClasses } from '@/lib/phase-colors';
import { cn } from '@/lib/utils';

export interface WizardStepRow {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  status: StatusCode;
  stepNumber: number;
  phaseId: string;
  phaseTitle: string;
}

const CANVAS_ID = 'checklist-step-canvas';

interface ChecklistClientWizardProps {
  items: WizardStepRow[];
  readOnly?: boolean;
  clientEditable?: boolean;
}

function phaseComplete(items: WizardStepRow[], phaseId: string): boolean {
  const rows = items.filter((row) => row.phaseId === phaseId);
  return rows.length > 0 && rows.every((row) => row.gate.kind === 'done');
}

export function ChecklistClientWizard({
  items,
  readOnly = false,
  clientEditable = false,
}: ChecklistClientWizardProps) {
  const { selectedClient, getState, getStateForEngagement, engagements } = useApp();
  const engagement = useMemo(
    () =>
      selectedClient
        ? engagements.find((e) => e.id === selectedClient.id || e.clientId === selectedClient.id)
        : undefined,
    [engagements, selectedClient],
  );
  const state = useMemo(
    () =>
      selectedClient
        ? engagement
          ? getStateForEngagement(engagement)
          : getState(selectedClient.id)
        : {},
    [selectedClient, engagement, getState, getStateForEngagement],
  );
  const incorporationDate =
    selectedClient?.incorporationDate?.trim() ||
    state['pre-12']?.responses?.dateOfIncorporation?.trim() ||
    null;

  const yourTurn = items.find(
    (row) => row.gate.kind === 'active' && row.item.responsibleRole === 'client',
  );
  const current = items.find((row) => row.gate.kind === 'active' || row.gate.kind === 'waiting');
  const currentId =
    current?.item.id ?? items.find((row) => row.gate.kind === 'done')?.item.id ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // `?step=` from a "please fill this" email opens that step, once, if it is unlocked.
  const searchParams = useSearchParams();
  const requestedStepId = searchParams.get('step');
  const consumedRequestedStep = useRef(false);
  useEffect(() => {
    if (consumedRequestedStep.current || !requestedStepId) return;
    const row = items.find((entry) => entry.item.id === requestedStepId);
    if (!row) return;
    consumedRequestedStep.current = true;
    if (!row.gate.canOpen) return;
    setSelectedId(requestedStepId);
  }, [requestedStepId, items]);

  const prevCurrentId = useRef(currentId);
  useEffect(() => {
    const previous = prevCurrentId.current;
    prevCurrentId.current = currentId;
    setSelectedId((prev) => {
      if (previous && previous !== currentId && (!prev || prev === previous)) {
        return currentId;
      }
      if (prev) {
        const prevGate = items.find((row) => row.item.id === prev)?.gate;
        if (prevGate?.canOpen) return prev;
      }
      return currentId;
    });
  }, [currentId, items]);

  const selected =
    items.find((row) => row.item.id === selectedId) ?? current ?? null;

  const selectStep = (itemId: string) => {
    const row = items.find((entry) => entry.item.id === itemId);
    if (!row?.gate.canOpen) return;
    setSelectedId(itemId);
    requestAnimationFrame(() => {
      document
        .getElementById(CANVAS_ID)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  if (items.length === 0) return null;

  const flowProps = {
    items,
    selectedId: selected?.item.id ?? null,
    onSelect: selectStep,
  };

  const allDone = items.every((row) => row.gate.kind === 'done');
  const waitingOnLead =
    current?.gate.kind === 'waiting' ||
    (current?.gate.kind === 'active' && current.item.responsibleRole !== 'client' && !yourTurn);
  const selectedPhase = selected ? phaseClasses(selected.phaseId, selected.item.bucket) : null;
  const phaseIds = [...new Set(items.map((row) => row.phaseId))];

  return (
    <div className="relative w-full min-h-[calc(100vh-var(--shell-sticky-top)-2.5rem)] page-fade-up lg:pr-[14rem] xl:pr-[14.75rem]">
      {yourTurn ? (
        <YourTurnBanner
          className="mb-5"
          stepTitle={yourTurn.item.title}
          stepNumber={yourTurn.stepNumber}
          phaseTitle={yourTurn.phaseTitle}
          onOpen={() => selectStep(yourTurn.item.id)}
        />
      ) : null}

      {phaseIds.map((phaseId) => {
        const title = items.find((row) => row.phaseId === phaseId)?.phaseTitle ?? phaseId;
        return (
          <PhaseCelebration
            key={phaseId}
            phaseId={phaseId}
            phaseTitle={title}
            completed={phaseComplete(items, phaseId)}
            className="mb-4"
          />
        );
      })}

      <div className="mb-8 lg:hidden">
        {selectedPhase ? (
          <div
            className={cn(
              'mb-3 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]',
              selectedPhase.soft,
              selectedPhase.label,
            )}
          >
            {selected?.phaseTitle ?? 'Incorporation'}
          </div>
        ) : null}
        <ChecklistClientFlow {...flowProps} variant="compact" />
      </div>

      {selected && selected.gate.canOpen ? (
        <section
          id={CANVAS_ID}
          className={cn(
            'surface scroll-mt-24 p-4 sm:p-6',
            selected.gate.kind === 'active' &&
              'ring-2 ring-primary/35 ring-offset-2 ring-offset-background',
            selected.gate.kind === 'waiting' && 'border-warning/40',
          )}
        >
          {selected.item.bucket === 'post-inc' && !incorporationDate ? (
            <p className="mb-4 rounded-md border border-primary/20 bg-primary-light/70 px-3 py-2.5 text-xs leading-relaxed text-foreground/80">
              Deadlines appear after incorporation.
            </p>
          ) : null}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums">
              Step {selected.stepNumber}
            </span>
            {selected.gate.kind === 'done' ? (
              <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                Completed · view only
              </span>
            ) : null}
            <ResponsibleRoleBadge role={selected.item.responsibleRole} />
            <StatusBadgeWithTimeline
              status={gateDisplayStatus(selected.status, selected.gate)}
              item={selected.item}
            />
          </div>
          <h3 className="serif text-xl font-semibold text-foreground">{selected.item.title}</h3>
          {selected.item.description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {selected.item.description}
            </p>
          ) : null}
          <ChecklistStepCanvas
            item={selected.item}
            gate={selected.gate}
            variant="client"
            readOnly={readOnly || !selected.gate.canEdit}
            clientEditable={clientEditable && selected.gate.canEdit}
            className="mt-5"
          />
        </section>
      ) : allDone ? (
        <div className="surface flex flex-col items-center px-6 py-10 text-center">
          <GeometricEmpty variant="success" />
          <p className="mt-3 serif text-xl text-success-text">All incorporation steps are complete</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Your setup checklist is finished. Documents and filings stay available in your vault.
          </p>
        </div>
      ) : waitingOnLead ? (
        <section className="surface flex flex-col items-center px-6 py-10 text-center">
          <GeometricEmpty variant="waiting" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Waiting on your project lead</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {current?.gate.message ??
              'Your lead is reviewing or preparing the next step. We will notify you when it is your turn.'}
          </p>
        </section>
      ) : (
        <section className="surface flex items-start gap-3 p-4 sm:p-5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-foreground">This step is not open yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.find((row) => row.gate.kind === 'locked')?.gate.message ??
                'This opens after the previous step is complete.'}
            </p>
          </div>
        </section>
      )}

      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-20 hidden w-[13.25rem] lg:block xl:w-[14rem]">
        <div className="pointer-events-auto sticky top-[var(--shell-sticky-top)] h-[calc(100vh-var(--shell-sticky-top)-0.75rem)]">
          <ChecklistClientFlow {...flowProps} variant="rail" className="h-full" />
        </div>
      </div>
    </div>
  );
}
