'use client';

import { Robot } from '@/components/card-agent/Robot';
import { agentNameOf } from '@/lib/assist-agents/catalog';
import { CARD_AGENT_COLOUR } from '@/lib/card-agents/card-agents';
import { cn } from '@/lib/utils';
import { assistHintForStep } from './agent-hint';

/**
 * "Agent available" — a small card on the staff step page when a card agent covers this step's
 * portal form (docs/specs/live-portal-browser/CARD-AGENTS.md). It points to the robot in the
 * corner of the page, which checks the data and starts the work; the VCFO Assist side panel in
 * Chrome is named only as the fallback. Staff only: the step page renders it outside the client
 * route. Renders nothing for a step no agent covers.
 */
export function AssistAgentHint({ stepId, className }: { stepId: string; className?: string }) {
  const hint = assistHintForStep(stepId);
  if (!hint) return null;
  const { lead, others, status } = hint;
  const name = agentNameOf(lead);
  return (
    <section
      aria-label="VCFO Assist agent"
      className={cn('surface mb-3.5 flex items-start gap-3 px-3.5 py-3 text-[13px]', className)}
    >
      <Robot color={CARD_AGENT_COLOUR[lead.agent]} size={32} mood={status === 'later' ? 'blocked' : 'idle'} />
      <div className="min-w-0 flex-1">
        {/* The robot in the corner shows its true level (Ready, Practice, Prepares data, Coming); no second word here. */}
        <p className="font-medium text-ink">{name} is on this page</p>
        <p className="mt-0.5 text-ink-muted">
          {lead.title}: {lead.form}
          {others.length ? `, with ${others.map((s) => s.form).join(', ')}` : ''}. Click its robot at the bottom right of this page to
          check the data and start. Where it cannot fill yet, the VCFO Assist side panel in Chrome next to the portal is the
          fallback.
        </p>
      </div>
    </section>
  );
}
