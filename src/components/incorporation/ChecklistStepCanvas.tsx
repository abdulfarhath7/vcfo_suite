'use client';

import { useMemo } from 'react';
import type { ChecklistItem } from '@/data/checklist';
import { useApp } from '@/context/AppContext';
import { Phase1StepPanel } from '@/components/incorporation/Phase1StepPanel';
import { hasResponseFormFields } from '@/lib/checklist-field-access';
import { extractItemResponses } from '@/lib/checklist-responses';
import type { ChecklistStepGate } from '@/lib/checklist-step-gate';
import { ItemDetailSlideOver } from '@/views/incorporation/ItemDetailSlideOver';
import { MilestoneResponseForm } from '@/views/incorporation/MilestoneResponseForm';
import { cn } from '@/lib/utils';

const PHASE1_PANEL_IDS = new Set([
  'pre-2',
  'pre-3',
  'pre-4',
  'pre-5',
  'pre-7',
  'pre-8',
  'pre-9',
  'pre-10',
  'pre-11',
  'pre-12',
]);

interface ChecklistStepCanvasProps {
  item: ChecklistItem;
  gate: ChecklistStepGate;
  variant: 'admin' | 'client';
  readOnly?: boolean;
  clientEditable?: boolean;
  className?: string;
}

/** Active (or reviewable) step body — form, phase panel, details. */
export function ChecklistStepCanvas({
  item,
  gate,
  variant,
  readOnly = false,
  clientEditable = false,
  className,
}: ChecklistStepCanvasProps) {
  const { selectedClient, getState, getStateForEngagement, engagements } = useApp();
  const isClient = variant === 'client';
  const engagement = useMemo(
    () =>
      selectedClient
        ? engagements.find((e) => e.id === selectedClient.id || e.clientId === selectedClient.id)
        : undefined,
    [engagements, selectedClient],
  );

  if (!selectedClient) return null;

  const itState = engagement
    ? getStateForEngagement(engagement)[item.id]
    : getState(selectedClient.id)[item.id];
  const responses = extractItemResponses(item, itState);
  const formReadOnly = readOnly || !gate.canEdit;
  const showForm =
    (clientEditable || variant === 'admin') && hasResponseFormFields(item, variant);

  return (
    <div className={cn('space-y-4', className)}>
      {gate.kind === 'waiting' && gate.message && (
        <div className="rounded-lg border border-warning/30 bg-warning-light/60 px-3 py-2.5 text-sm text-warning-text">
          {gate.message}
        </div>
      )}

      {PHASE1_PANEL_IDS.has(item.id) && (
        <Phase1StepPanel
          item={item}
          engagement={engagement}
          responses={responses}
          variant={variant}
        />
      )}

      {showForm && (
        <MilestoneResponseForm
          item={item}
          clientId={engagement?.id ?? selectedClient.id}
          engagementId={engagement?.id}
          variant={variant}
          readOnly={formReadOnly}
        />
      )}

      <ItemDetailSlideOver
        item={item}
        readOnly={formReadOnly || isClient}
        clientEditable={false}
        variant={variant}
      />
    </div>
  );
}
