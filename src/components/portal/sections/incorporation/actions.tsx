'use client';

/**
 * CONTRACT (used by Home, Registrations, Master calendar, Search, the Ask VCFO chat and the route intents — keep the signatures):
 *   useStepActions() → {
 *     showStep(stepId)        select the step in its section (Incorporation, or Registrations for reg-* steps) and scroll there;
 *     openStepWizard(stepId)  open the step-by-step walkthrough of the step's phase, on that step, with the real step
 *                             form / upload / approval inside when the client has something to do;
 *   }
 * `stepId` may be a step id (pre-13) or a catalog slug (capital-structure).
 */
import { useCallback, useMemo } from 'react';
import { getIncorporationPhases } from '@/data/checklist';
import { usePortal } from '../../runtime';
import { isRegistrationStep, resolveStepId } from './model';
import { setIncSelection } from './store';
import { selectRegistration } from '../registrations/store';
import { StepWizard } from './StepWizard';

export interface StepActions {
  showStep: (stepId: string) => void;
  openStepWizard: (stepId: string) => void;
}

/** Phase number (1–4) of a catalog step id. */
let PHASE_OF: Record<string, number> | null = null;
function phaseNoOf(id: string): number {
  PHASE_OF ??= Object.fromEntries(getIncorporationPhases().flatMap((p, i) => p.items.map((it) => [it.id, i + 1] as const)));
  return PHASE_OF[id] ?? 1;
}

export function useStepActions(): StepActions {
  const { go, openWizard, toast } = usePortal();
  const showStep = useCallback(
    (stepId: string) => {
      const id = resolveStepId(stepId);
      if (!id) {
        toast('That step is not on your checklist.');
        return;
      }
      if (isRegistrationStep(id)) {
        selectRegistration(id);
        window.setTimeout(() => go('registrations'), 30);
        return;
      }
      setIncSelection({ phaseNo: phaseNoOf(id), stepId: id }, true);
      // let the section render the selection first, then land on the step detail
      window.setTimeout(() => go('incorporation', { target: 'stepdetail' }), 30);
    },
    [go, toast],
  );
  const openStepWizard = useCallback(
    (stepId: string) => {
      const id = resolveStepId(stepId);
      if (!id) {
        toast('That step is not on your checklist.');
        return;
      }
      if (!isRegistrationStep(id)) setIncSelection({ phaseNo: phaseNoOf(id), stepId: id });
      openWizard(<StepWizard stepId={id} />);
    },
    [openWizard, toast],
  );
  return useMemo(() => ({ showStep, openStepWizard }), [showStep, openStepWizard]);
}