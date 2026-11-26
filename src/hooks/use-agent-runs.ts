'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentResults, AgentRunFilters, AgentRunItem, AgentsTodaySummary } from '@/lib/card-agents/overview';
import type { AgentSettingsResponse } from '@/lib/card-agents/settings-page';
import type { AgentSettingKey, AgentSettings } from '@/lib/card-agents/settings';

/**
 * The card agents' staff pages: "Agents today", the control room, Settings > Agents and Agent
 * results (`/api/agent-runs`, `/api/agent-runs/summary`, `/api/agent-settings`, `/api/agent-results`).
 */

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'request_failed');
  return data;
}

const hasOpen = (runs: AgentRunItem[] | undefined) => Boolean(runs?.some((r) => r.bucket === 'running' || r.bucket === 'your_turn'));

/** "Agents today" on the staff home. It looks again every 15 seconds while something is open. */
export function useAgentsToday(enabled = true) {
  return useQuery({
    queryKey: ['agent-runs', 'summary'],
    enabled,
    queryFn: async () => (await readJson<{ summary: AgentsTodaySummary }>(await fetch('/api/agent-runs/summary'))).summary,
    refetchInterval: (query) => (query.state.data && (query.state.data.running > 0 || query.state.data.yourTurn > 0) ? 15_000 : false),
  });
}

export function useAgentRunsList(filters: AgentRunFilters) {
  const qs = new URLSearchParams({ state: filters.state, period: filters.period, ...(filters.agent ? { agent: filters.agent } : {}), ...(filters.search ? { search: filters.search } : {}) });
  return useQuery({
    queryKey: ['agent-runs', 'list', qs.toString()],
    queryFn: async () =>
      readJson<{ runs: AgentRunItem[]; agents: Array<{ taskId: string; name: string; count: number }> }>(await fetch(`/api/agent-runs?${qs.toString()}`)),
    refetchInterval: (query) => (hasOpen(query.state.data?.runs) ? 10_000 : false),
  });
}

export function useAgentSettingsPage(enabled = true) {
  return useQuery({
    queryKey: ['agent-settings'],
    enabled,
    queryFn: async () => readJson<AgentSettingsResponse>(await fetch('/api/agent-settings')),
  });
}

export function useSaveAgentSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: AgentSettingKey; value: unknown }) =>
      readJson<{ settings: AgentSettings }>(
        await fetch('/api/agent-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-settings'] }),
  });
}

export function useAgentResults(month: string, enabled = true) {
  return useQuery({
    queryKey: ['agent-results', month],
    enabled,
    queryFn: async () => readJson<{ results: AgentResults; estimateNote: string }>(await fetch(`/api/agent-results?month=${encodeURIComponent(month)}`)),
  });
}
