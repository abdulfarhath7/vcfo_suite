import 'server-only';
import type { JobFunction, JobRun, Reach } from './types';
import { missingEnv, notSetUp, reach } from './reach';
import { inngest } from '@/jobs/client';
import { canRetryRun, runsForEvent, type InngestEvent, type InngestRun } from './parse';

/**
 * Inngest run history over the REST API (plain fetch, no SDK), authorised with the app's
 * signing key. It lists the recent events and then the runs each event started, because the
 * v1 API has no "runs per function" list. Event payloads are never passed on.
 *
 * Env: INNGEST_SIGNING_KEY (required), INNGEST_API_BASE_URL (optional, for the local dev
 * server; the default is the Inngest cloud API). A retry also needs INNGEST_EVENT_KEY.
 */

const MAX_EVENTS = 40;
const PARALLEL = 6;

function base(): string {
  return (process.env.INNGEST_API_BASE_URL?.trim() || 'https://api.inngest.com').replace(/\/+$/, '');
}

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${process.env.INNGEST_SIGNING_KEY?.trim() ?? ''}` },
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Inngest answered ${res.status}`);
  return (await res.json()) as T;
}

export async function listInngestRuns(fns: JobFunction[], days = 7): Promise<Reach<JobRun[]>> {
  const missing = missingEnv(['INNGEST_SIGNING_KEY']);
  if (missing.length) return notSetUp(missing);

  return reach(async (signal) => {
    const after = new Date(Date.now() - days * 86400000).toISOString();
    const events = await get<{ data?: InngestEvent[] }>(
      `/v1/events?limit=${MAX_EVENTS}&received_after=${encodeURIComponent(after)}`,
      signal,
    );
    const list = (events.data ?? []).slice(0, MAX_EVENTS);
    const out: JobRun[] = [];
    for (let i = 0; i < list.length; i += PARALLEL) {
      const batch = list.slice(i, i + PARALLEL);
      const runs = await Promise.all(
        batch.map(async (ev) => {
          const key = ev.internal_id ?? ev.id;
          if (!key) return [];
          const r = await get<{ data?: InngestRun[] }>(`/v1/events/${encodeURIComponent(key)}/runs`, signal).catch(() => ({ data: [] }));
          return runsForEvent(ev, r.data ?? [], fns);
        }),
      );
      out.push(...runs.flat());
    }
    return out.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  }, 8000);
}

export type RetryOutcome =
  | { ok: true; event: string; functionId: string | null; sentIds: string[] }
  | { ok: false; error: 'not_set_up' | 'not_found' | 'not_retryable'; missing?: string[] };

/**
 * Start a failed run again: read the event that started it (server side, the payload never
 * leaves the server), check the run is still listed as failed for that event and that only
 * one function listens to the event (`canRetryRun`), then send the same event once more.
 */
export async function retryInngestRun(input: { runId: string; eventId: string }, fns: JobFunction[]): Promise<RetryOutcome> {
  const missing = missingEnv(['INNGEST_SIGNING_KEY', 'INNGEST_EVENT_KEY']);
  if (missing.length) return { ok: false, error: 'not_set_up', missing };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const ev = await get<{ data?: (InngestEvent & { data?: Record<string, unknown> | null }) | null }>(
      `/v1/events/${encodeURIComponent(input.eventId)}`,
      ctrl.signal,
    ).catch(() => ({ data: null }));
    const event = ev.data;
    if (!event?.name) return { ok: false, error: 'not_found' };

    const runs = await get<{ data?: InngestRun[] }>(`/v1/events/${encodeURIComponent(input.eventId)}/runs`, ctrl.signal).catch(() => ({ data: [] }));
    const run = runsForEvent(event, runs.data ?? [], fns).find((r) => r.id === input.runId);
    if (!run) return { ok: false, error: 'not_found' };
    if (!canRetryRun(run, fns)) return { ok: false, error: 'not_retryable' };

    const sent = await inngest.send({ name: event.name, data: (event.data ?? {}) as Record<string, unknown> });
    return { ok: true, event: event.name, functionId: run.functionId, sentIds: sent.ids ?? [] };
  } finally {
    clearTimeout(timer);
  }
}
