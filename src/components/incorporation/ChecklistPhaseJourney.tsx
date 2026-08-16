'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChecklistItem, ChecklistPhaseGroup, StatusCode } from '@/data/checklist';
import { useApp } from '@/context/AppContext';
import { checklistPhaseRailLabel } from '@/components/incorporation/ChecklistClientFlow';
import { ChecklistClientWizard } from '@/components/incorporation/ChecklistClientWizard';
import { ChecklistJourneyRail } from '@/components/incorporation/ChecklistJourneyRail';
import { ChecklistStepCanvas } from '@/components/incorporation/ChecklistStepCanvas';
import { ResponsibleRoleBadge } from '@/components/incorporation/ResponsibleRoleBadge';
import { StatusBadgeWithTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { phaseClasses } from '@/lib/phase-colors';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import { cn } from '@/lib/utils';

type PhaseWithItems = ChecklistPhaseGroup & { items: ChecklistItem[] };

interface ChecklistPhaseJourneyProps {
  phases: PhaseWithItems[];
  variant?: 'admin' | 'client';
  readOnly?: boolean;
  clientEditable?: boolean;
}

function stepNumberInPhases(phases: PhaseWithItems[], itemId: string): number {
  for (const phase of phases) {
    const idx = phase.items.findIndex((item) => item.id === itemId);
    if (idx >= 0) return idx + 1;
  }
  return 0;
}

export function ChecklistPhaseJourney({
  phases,
  variant = 'admin',
  readOnly = false,
  clientEditable = false,
}: ChecklistPhaseJourneyProps) {
  const { selectedClient, getState, getStateForEngagement, engagements, user } = useApp();
  const isClient = variant === 'client';
  const engagement = useMemo(
    () =>
      selectedClient
        ? engagements.find((e) => e.id === selectedClient.id || e.clientId === selectedClient.id)
        : undefined,
    [engagements, selectedClient],
  );
  const { snapshot: brSnapshot } = useBoardResolutionProgress(engagement?.id);

  const sectionItems = useMemo(() => phases.flatMap((phase) => phase.items), [phases]);
  const state = useMemo(
    () =>
      selectedClient
        ? engagement
          ? getStateForEngagement(engagement)
          : getState(selectedClient.id)
        : {},
    [selectedClient, engagement, getState, getStateForEngagement],
  );

  const viewer = checklistGateViewerFrom(variant, user?.role);
  const gates = useMemo(() => gateActiveCatalog(state, viewer), [state, viewer]);

  const rows = useMemo(
    () =>
      sectionItems.map((item, index) => {
        const slice = state[item.id];
        const gate = getStepGate(gates, item.id);
        const status = deriveChecklistDisplayStatus(item.id, item, slice, brSnapshot);
        const phase = phases.find((entry) => entry.items.some((step) => step.id === item.id));
        return {
          item,
          gate,
          status: gateDisplayStatus(status, gate) as StatusCode,
          rawStatus: status,
          stepNumber: isClient ? index + 1 : stepNumberInPhases(phases, item.id),
          phaseId: phase?.id ?? '',
          phaseTitle: checklistPhaseRailLabel(phase?.id ?? '', phase?.subtitle ?? phase?.title ?? ''),
        };
      }),
    [sectionItems, state, gates, brSnapshot, phases, isClient],
  );

  const currentId =
    rows.find((row) => row.gate.kind === 'active' || row.gate.kind === 'waiting')?.item.id ??
    rows.find((row) => row.gate.kind === 'done')?.item.id ??
    null;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId((prev) => {
      if (prev) {
        const prevGate = getStepGate(gates, prev);
        if (prevGate.kind === 'active' || prevGate.kind === 'waiting') return prev;
        if (prevGate.kind === 'done' && currentId && currentId !== prev) return currentId;
        if (prevGate.canOpen) return prev;
      }
      return currentId;
    });
  }, [currentId, gates]);

  const selected = rows.find((row) => row.item.id === selectedId) ?? rows.find((row) => row.item.id === currentId);

  if (!selectedClient) return null;

  if (isClient) {
    return (
      <ChecklistClientWizard
        items={rows}
        readOnly={readOnly}
        clientEditable={clientEditable}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="space-y-5">
          {phases.map((phase) => {
            const phaseRows = rows.filter((row) => phase.items.some((item) => item.id === row.item.id));
            const tint = phaseClasses(phase.id);
            return (
              <div key={phase.id}>
                <p
                  className={cn(
                    'mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide',
                    tint.soft,
                    tint.label,
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
                  {checklistPhaseRailLabel(phase.id, phase.title)}
                </p>
                <ChecklistJourneyRail
                  items={phaseRows}
                  selectedId={selected?.item.id ?? null}
                  onSelect={setSelectedId}
                />
              </div>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0">
        {selected && selected.gate.canOpen ? (
          <section
            className={cn(
              'surface p-4 sm:p-6',
              selected.gate.kind === 'active' &&
                'ring-2 ring-primary/35 ring-offset-2 ring-offset-background',
              selected.gate.kind === 'waiting' && 'border-warning/40',
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ResponsibleRoleBadge role={selected.item.responsibleRole} />
              <StatusBadgeWithTimeline status={selected.status} item={selected.item} />
            </div>
            <h3 className="serif text-xl font-semibold text-foreground">{selected.item.title}</h3>
            {selected.item.description && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {selected.item.description}
              </p>
            )}
            {selected.item.notes && (
              <p className="mt-2 text-xs text-muted-foreground">{selected.item.notes}</p>
            )}
            <ChecklistStepCanvas
              item={selected.item}
              gate={selected.gate}
              variant={variant}
              readOnly={readOnly || !selected.gate.canEdit}
              clientEditable={clientEditable && selected.gate.canEdit}
              className="mt-5"
            />
          </section>
        ) : (
          <section className="surface p-6 text-sm text-muted-foreground">
            Select an unlocked step from the journey rail.
          </section>
        )}
      </div>
    </div>
  );
}
