'use client';

/**
 * The step-by-step walkthrough of one incorporation phase (prototype
 * openStepWizard, a6_rest.js), opened on one step. It reads the live step model,
 * so the cards refresh when a submit / upload / approval changes the data.
 * Steps where the client has something to do carry <StepWork> as the card's
 * `extra`; a step with the fillable form drops the Next / Back footer (the form
 * brings Save / Submit, and the rail moves between steps).
 */
import { useMemo } from 'react';
import { WizardView, type WizState, type WizStep, type WizWho } from '../../overlays';
import { useIncorporationExtras, usePortalIncorporation } from '../../data';
import { usePortal } from '../../runtime';
import { fmt } from '../../dates';
import { PHASE_NAMES, PHASE_SUB, phInfo, phWhy, protoState, resolveStepId, stepDescription, stepNeeds, type ProtoState } from './model';
import { StepWork, planStepWork } from './StepWork';

const WSTATE: Record<ProtoState, WizState> = { done: 'done', over: 'stuck', you: 'now', prog: 'now', up: 'up', na: 'na' };

export function StepWizard({ stepId, phaseNo }: { stepId?: string; phaseNo?: number }) {
  const { shell } = usePortal();
  const { model, engagement, loading } = usePortalIncorporation();
  const extras = useIncorporationExtras();
  const id = stepId ? resolveStepId(stepId) : undefined;
  const s0 = id ? model.byId[id] : undefined;
  const pn = s0?.phaseNo ?? phaseNo ?? 1;
  const phase = model.phases[pn - 1];
  const short = shell?.companyShort || 'your company';

  const steps: WizStep[] = useMemo(() => {
    if (!phase) return [];
    return phase.steps.map((s) => {
      const st = protoState(s);
      const plan = planStepWork(s, extras.data, Boolean(engagement));
      const who: WizWho = s.owner === 'client' ? 'YOU' : s.owner === 'mca' ? 'MCA' : 'SBC';
      const desc = stepDescription(s.item);
      const needs = stepNeeds(s.item);
      const when =
        st === 'done'
          ? s.doneOn
            ? `Done on ${fmt(s.doneOn)}.`
            : ''
          : s.due
            ? `${st === 'over' ? 'Was due' : 'Due'} ${fmt(s.due)}.`
            : '';
      const body = [desc || (needs.length ? `It needs: ${needs.join(', ')}.` : ''), when].filter(Boolean).join(' ');
      const sub = st === 'over' ? `It was due on ${s.due ? fmt(s.due) : 'an earlier date'} and is ${s.lateDays} day${s.lateDays === 1 ? '' : 's'} late${s.owner === 'client' ? ` · waiting on ${short}` : ''}.` : undefined;
      const showWork = plan.actionable || plan.board || s.kind === 'done';
      return {
        who,
        title: s.title,
        body,
        sub,
        state: WSTATE[st],
        extra: showWork ? <StepWork stepId={s.id} /> : undefined,
        noFoot: plan.form,
      };
    });
  }, [phase, extras.data, engagement, id, short]);

  if (!phase) return <div className="sec-load">{loading ? 'Loading…' : 'This phase is not on your checklist.'}</div>;
  const app = phase.steps.filter((s) => protoState(s) !== 'na');
  const doneN = app.filter((s) => s.kind === 'done').length;
  const start = s0 ? phase.steps.findIndex((s) => s.id === s0.id) : undefined;
  return (
    <WizardView
      title={PHASE_NAMES[pn - 1] ?? phase.name}
      sub={`${PHASE_SUB[pn - 1] ?? phase.name} · ${doneN} of ${app.length} done`}
      steps={steps}
      start={start !== undefined && start >= 0 ? start : undefined}
      what={`${phInfo(short)[pn - 1] ?? ''} ${phWhy(short)[pn - 1] ?? ''}`.trim()}
      docs={[...new Set(phase.steps.flatMap((s) => s.item.forms))]}
      ask={s0 ? `What is ${s0.title}?` : PHASE_NAMES[pn - 1]}
    />
  );
}
