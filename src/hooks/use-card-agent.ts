'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCardAgentContext, type CardAgentCard } from '@/components/card-agent/card-agent-context';
import type { CardAgentInfo } from '@/lib/card-agents/card-agents';
import { apiFetch } from '@/lib/projects/engagements-db';

export const CARD_AGENTS_QUERY_KEY = 'card-agents';

export interface CardAgentInput {
  /** Null or empty while the page has no engagement yet, or on the client's own route. */
  engagementId: string | null | undefined;
  stepId?: string | null;
  obligationId?: string | null;
  instanceId?: string | null;
}

/**
 * A card page tells the corner dock which card is open, so the dock can show that card's robot
 * beside Ask VCFO (docs/specs/live-portal-browser/CARD-AGENTS.md). Call it once per page with the
 * engagement and the step or obligation. It does nothing outside the staff shell, so a client page
 * that shares the view never gets a card agent.
 */
export function useCardAgent({ engagementId, stepId, obligationId, instanceId }: CardAgentInput): void {
  const register = useCardAgentContext()?.register;
  useEffect(() => {
    if (!register || !engagementId || (!stepId && !obligationId)) return;
    return register({ engagementId, stepId: stepId ?? null, obligationId: stepId ? null : obligationId ?? null, instanceId: instanceId ?? null });
  }, [register, engagementId, stepId, obligationId, instanceId]);
}

export interface CardAgentsRead {
  agents: CardAgentInfo[];
  companyName: string;
  /** Per task, the Assist profile sections its recipe fills ("Before I fill" lists only those). */
  sections?: Record<string, string[]>;
}

function cardQuery(card: CardAgentCard): string {
  const q = new URLSearchParams({ engagementId: card.engagementId });
  if (card.stepId) q.set('stepId', card.stepId);
  else if (card.obligationId) q.set('obligationId', card.obligationId);
  if (card.instanceId) q.set('instanceId', card.instanceId);
  return q.toString();
}

/** The robots of one card with their levels (`GET /api/card-agents`). */
export function useCardAgentInfo(card: CardAgentCard | null) {
  return useQuery({
    queryKey: [CARD_AGENTS_QUERY_KEY, card?.engagementId ?? '', card?.stepId ?? '', card?.obligationId ?? '', card?.instanceId ?? ''] as const,
    queryFn: () => apiFetch<{ ok: true } & CardAgentsRead>(`/api/card-agents?${cardQuery(card as CardAgentCard)}`, { fallbackError: 'Could not load the card agent.' }),
    enabled: Boolean(card),
    staleTime: 60_000,
  });
}

/** The robots of several checklist steps, for the Registrations boxes (no engagement). */
export function useCardAgentStepLevels(stepIds: readonly string[], enabled = true) {
  const ids = [...new Set(stepIds)].sort();
  return useQuery({
    queryKey: [CARD_AGENTS_QUERY_KEY, 'steps', ids.join(',')] as const,
    queryFn: () =>
      apiFetch<{ ok: true; steps: Record<string, CardAgentInfo[]> }>(`/api/card-agents?stepIds=${encodeURIComponent(ids.join(','))}`, {
        fallbackError: 'Could not load the card agents.',
      }).then((b) => b.steps),
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
  });
}
