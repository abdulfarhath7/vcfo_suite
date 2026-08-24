'use client';

import type { StatusCode } from '@/data/checklist';
import {
  REGISTRATION_WORKFLOW_OWNER,
  REGISTRATION_WORKFLOW_STAGES,
  REGISTRATION_WORKFLOW_LABEL,
  type RegistrationWorkflowStage,
} from '@/lib/registration-workflow';
import { cn } from '@/lib/utils';

interface RegistrationWorkflowControlsProps {
  status: StatusCode;
  workflowStage?: RegistrationWorkflowStage;
  readOnly?: boolean;
  onStatusChange: (status: StatusCode) => void;
  onWorkflowStageChange: (stage: RegistrationWorkflowStage) => void;
}

/** Project-lead applicability + Client → VCFO → Department stage tracker. */
export function RegistrationWorkflowControls({
  status,
  workflowStage,
  readOnly = false,
  onStatusChange,
  onWorkflowStageChange,
}: RegistrationWorkflowControlsProps) {
  const isNa = status === 'not-applicable';
  const activeStage = workflowStage ?? 'collection';

  return (
    <div className="space-y-3 rounded-md border border-border bg-raised/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Applicability
          </p>
        </div>
        {readOnly ? (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium',
              isNa ? 'bg-muted text-text-tertiary' : 'bg-success-light text-success-text',
            )}
          >
            {isNa ? 'Not applicable' : 'Applicable'}
          </span>
        ) : (
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => {
                if (isNa) onStatusChange('not-started');
              }}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                !isNa ? 'bg-ink text-paper' : 'text-text-secondary hover:text-ink',
              )}
              aria-pressed={!isNa}
            >
              Applicable
            </button>
            <button
              type="button"
              onClick={() => onStatusChange('not-applicable')}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                isNa ? 'bg-ink text-paper' : 'text-text-secondary hover:text-ink',
              )}
              aria-pressed={isNa}
            >
              N/A
            </button>
          </div>
        )}
      </div>

      {!isNa && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Registration workflow
          </p>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            {REGISTRATION_WORKFLOW_STAGES.map((stage, index) => {
              const selected = activeStage === stage;
              const reached =
                REGISTRATION_WORKFLOW_STAGES.indexOf(activeStage) >= index;
              return (
                <button
                  key={stage}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onWorkflowStageChange(stage)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-left transition-colors',
                    selected
                      ? 'border-blue-500/60 bg-blue-50 text-blue-900'
                      : reached
                        ? 'border-border bg-background text-ink'
                        : 'border-border/70 bg-transparent text-text-tertiary',
                    readOnly && 'cursor-default',
                    !readOnly && !selected && 'hover:border-blue-400/40 hover:bg-blue-50/40',
                  )}
                  aria-pressed={selected}
                >
                  <span className="block font-mono text-[10px] tabular-nums opacity-70">
                    {index + 1}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-semibold leading-tight">
                    {REGISTRATION_WORKFLOW_LABEL[stage]}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-tight opacity-80">
                    {REGISTRATION_WORKFLOW_OWNER[stage]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
