'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentOtpRequestView, GstForm, GstNoticeView, GstReturnRunView, GstinCheckResult, GstnSessionView } from '@/lib/gstzen/types';

/**
 * GSTZen card agents in the browser (MASTER-PLAN screens 7 and 8): the route status, the GST return
 * run with its session and OTP requests, the card's actions, GST notices, the GSTIN check, and the
 * client's own "Your turn" OTP list. An OTP typed here is posted once and never kept in a cache.
 */

const KEY = 'gstzen';

export interface GstzenStatus {
  open: boolean;
  message: string | null;
  gstin: string | null;
  session: GstnSessionView | null;
}

export interface GstRunBundle {
  run: GstReturnRunView;
  session: GstnSessionView | null;
  otp: AgentOtpRequestView[];
}

async function send<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw Object.assign(new Error(json.error || `Request failed (${res.status})`), { status: res.status });
  return json as T;
}

export function useGstzenStatus(engagementId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'status', engagementId],
    enabled: Boolean(engagementId),
    staleTime: 30_000,
    retry: false,
    queryFn: () => send<GstzenStatus>(`/api/gstzen/status?engagementId=${encodeURIComponent(engagementId!)}`, 'GET'),
  });
}

/**
 * The latest run for a form and period (null before the first start). With a filing instance and no
 * chosen period, the server reads the period from the instance and answers it.
 */
export function useGstReturnForPeriod(engagementId: string | null | undefined, form: GstForm, period: string | null, instanceId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'runs', engagementId, form, period, instanceId ?? null],
    enabled: Boolean(engagementId && (period || instanceId)),
    staleTime: 10_000,
    retry: false,
    queryFn: async () => {
      const q = new URLSearchParams({ engagementId: engagementId!, form });
      if (period) q.set('period', period);
      else if (instanceId) q.set('instanceId', instanceId);
      const out = await send<{ runs: GstReturnRunView[]; period: string | null }>(`/api/gstzen/returns?${q}`, 'GET');
      return { run: out.runs.find((r) => r.status !== 'cancelled') ?? out.runs[0] ?? null, period: out.period };
    },
  });
}

/** One run, polled every 4 seconds while the agent works or a person's OTP is awaited. */
export function useGstReturnRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: [KEY, 'run', runId],
    enabled: Boolean(runId),
    retry: false,
    queryFn: () => send<GstRunBundle>(`/api/gstzen/returns/${runId}`, 'GET'),
    refetchInterval: (q) => {
      const d = q.state.data as GstRunBundle | undefined;
      if (!d) return false;
      return d.run.flow.working || d.run.status === 'saving' || d.otp.length > 0 ? 4000 : false;
    },
  });
}

function useRunWrite<V>(fn: (v: V) => Promise<GstRunBundle>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (bundle) => {
      qc.setQueryData([KEY, 'run', bundle.run.id], bundle);
      void qc.invalidateQueries({ queryKey: [KEY, 'runs'] });
      void qc.invalidateQueries({ queryKey: [KEY, 'status'] });
    },
  });
}

export function useStartGstReturn() {
  return useRunWrite((v: { engagementId: string; form: GstForm; period: string }) => send<GstRunBundle>('/api/gstzen/returns', 'POST', v));
}

export type GstRunActionBody =
  | { action: 'save' | 'retry' | 'offset' | 'proceed' | 'refresh_balance' | 'cancel' }
  | { action: 'check'; which: 'figures' | 'unmatched'; checked: boolean }
  | { action: 'evc'; audience: 'staff' | 'client'; signatoryPan?: string | null };

export function useGstReturnAction(runId: string | null | undefined) {
  return useRunWrite((body: GstRunActionBody) => send<GstRunBundle>(`/api/gstzen/returns/${runId}`, 'POST', body));
}

export function useConsentOtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { engagementId: string; audience: 'staff' | 'client'; username?: string | null; runId?: string | null }) =>
      send<{ request?: AgentOtpRequestView; needsUsername?: boolean; message?: string }>('/api/gstzen/consent', 'POST', v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/**
 * Posts a typed OTP once. A plain call, not a React Query mutation, so the OTP is never held in the
 * query client's mutation cache; the caller clears its input straight after.
 */
export async function postOtp(who: 'staff' | 'client', requestId: string, otp: string): Promise<{ purpose: 'gstn_consent' | 'evc'; arn?: string }> {
  const url = who === 'client' ? `/api/client/agent-otp/${requestId}` : `/api/gstzen/otp/${requestId}`;
  return send<{ purpose: 'gstn_consent' | 'evc'; arn?: string }>(url, 'POST', { otp });
}

export function useGstNotices(engagementId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'notices', engagementId],
    enabled: Boolean(engagementId) && enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await send<{ notices: GstNoticeView[] }>(`/api/gstzen/notices?engagementId=${encodeURIComponent(engagementId!)}`, 'GET')).notices,
  });
}

export function useGstinCheck() {
  return useMutation({
    mutationFn: async (engagementId: string) => (await send<{ result: GstinCheckResult }>('/api/gstzen/gstin-check', 'POST', { engagementId })).result,
  });
}

/* ------------------------------------------------------------------ */
/* client portal                                                       */
/* ------------------------------------------------------------------ */

export function useClientOtpRequests(enabled = true) {
  return useQuery({
    queryKey: [KEY, 'client-otp'],
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => (await send<{ requests: AgentOtpRequestView[] }>('/api/client/agent-otp', 'GET')).requests,
  });
}

/** The query key prefix, for callers that refresh after posting an OTP. */
export const GSTZEN_QUERY_KEY = KEY;
