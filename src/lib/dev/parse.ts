import type { CostLine, JobFunction, JobRun, LogLevel } from './types';

/**
 * Pure parsing for the developer console readers, kept apart from the AWS and Inngest calls
 * so it can be tested without a network.
 */

// ---------- Logs ----------

/**
 * The level of a log line. App Runner keeps stdout as plain text, so the level comes from the
 * text: a JSON "level" field when the line is JSON, otherwise the first error or warn word.
 */
export function logLevelOf(message: string): LogLevel {
  const m = message.trim();
  if (m.startsWith('{')) {
    try {
      const j = JSON.parse(m) as { level?: unknown; severity?: unknown };
      const raw = String(j.level ?? j.severity ?? '').toLowerCase();
      if (/^(error|fatal|critical|50|60)$/.test(raw)) return 'error';
      if (/^(warn|warning|40)$/.test(raw)) return 'warn';
      if (raw) return 'info';
    } catch {
      // Not JSON after all; fall through to the word test.
    }
  }
  if (/\b(error|fatal|unhandled|exception|err_[a-z_]+)\b|⨯/i.test(m)) return 'error';
  if (/\b(warn|warning|deprecated)\b|⚠/i.test(m)) return 'warn';
  return 'info';
}

/**
 * A CloudWatch filter pattern for a free-text search: each word must appear. Quotes in the
 * input are dropped so a search cannot change the pattern's meaning.
 */
export function logFilterPattern(text: string): string | undefined {
  const words = text
    .replace(/["\\]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (!words.length) return undefined;
  return words.map((w) => `"${w}"`).join(' ');
}

// ---------- Costs ----------

type CeGroup = { Keys?: string[]; Metrics?: Record<string, { Amount?: string; Unit?: string }> };
type CeResult = { Groups?: CeGroup[] };

/** Sum Cost Explorer daily results by service, largest first, dropping lines under a cent. */
export function sumCostsByService(results: CeResult[], metric = 'UnblendedCost'): { currency: string; total: number; services: CostLine[] } {
  const by = new Map<string, number>();
  let currency = 'USD';
  for (const r of results) {
    for (const g of r.Groups ?? []) {
      const service = g.Keys?.[0] ?? 'Other';
      const m = g.Metrics?.[metric];
      const amount = Number(m?.Amount ?? 0);
      if (m?.Unit) currency = m.Unit;
      if (!Number.isFinite(amount)) continue;
      by.set(service, (by.get(service) ?? 0) + amount);
    }
  }
  const services = [...by.entries()]
    .map(([service, amount]) => ({ service, amount: Math.round(amount * 100) / 100 }))
    .filter((l) => l.amount >= 0.01)
    .sort((a, b) => b.amount - a.amount);
  const total = Math.round(services.reduce((a, l) => a + l.amount, 0) * 100) / 100;
  return { currency, total, services };
}

// ---------- Inngest ----------

type FnLike = { id: (prefix?: string) => string; name?: string; opts?: { retries?: number; triggers?: unknown } };

/** Describe registered Inngest functions from their own config (id, trigger, retries). */
export function describeFunctions(fns: FnLike[]): JobFunction[] {
  return fns.map((f) => {
    const triggers = (Array.isArray(f.opts?.triggers) ? f.opts?.triggers : f.opts?.triggers ? [f.opts.triggers] : []) as Array<{
      cron?: string;
      event?: string;
    }>;
    const t = triggers[0] ?? {};
    const id = f.id();
    return {
      id,
      name: f.name && f.name !== id ? f.name : id,
      trigger: t.cron ? { kind: 'cron', cron: t.cron } : { kind: 'event', event: t.event ?? '' },
      retries: typeof f.opts?.retries === 'number' ? f.opts.retries : null,
    } satisfies JobFunction;
  });
}

export type InngestEvent = { id?: string; internal_id?: string; name?: string; data?: { cron?: unknown } | null; received_at?: string };
export type InngestRun = { run_id?: string; status?: string; run_started_at?: string | null; ended_at?: string | null };

/**
 * The registered function an event triggered. An event trigger matches by name; a cron run
 * arrives as "inngest/scheduled.timer" with the cron string in its data.
 */
export function functionForEvent(ev: InngestEvent, fns: JobFunction[]): string | null {
  const name = ev.name ?? '';
  if (name === 'inngest/scheduled.timer') {
    const cron = typeof ev.data?.cron === 'string' ? ev.data.cron : '';
    return fns.find((f) => f.trigger.kind === 'cron' && f.trigger.cron === cron)?.id ?? null;
  }
  return fns.find((f) => f.trigger.kind === 'event' && f.trigger.event === name)?.id ?? null;
}

/** Turn Inngest runs for one event into console rows. Event data is dropped here. */
export function runsForEvent(ev: InngestEvent, runs: InngestRun[], fns: JobFunction[]): JobRun[] {
  const functionId = functionForEvent(ev, fns);
  return runs.map((r, i) => ({
    id: r.run_id ?? `${ev.internal_id ?? ev.id ?? 'event'}-${i}`,
    functionId,
    event: ev.name ?? '',
    status: r.status ?? 'Unknown',
    startedAt: r.run_started_at ?? ev.received_at ?? null,
    endedAt: r.ended_at ?? null,
  }));
}

/** Human words for a cron string the app uses; anything else is shown as the cron itself. */
export function cronWords(cron: string): string {
  const c = cron.replace(/^TZ=\S+\s+/, '').trim();
  const tz = /^TZ=Asia\/Kolkata/.test(cron) ? ' IST' : ' UTC';
  const m = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(c);
  if (m) return `Daily at ${m[2].padStart(2, '0')}:${m[1].padStart(2, '0')}${tz}`;
  return c;
}

// ---------- Outlook ----------

/**
 * Health of a linked Outlook mailbox. The access token lasts about an hour and refreshes on
 * the next send, so its expiry alone says little. The refresh token lapses after 90 days
 * without use, and each refresh rewrites the row, so `updatedAt` is the real clock.
 */
export function outlookHealth(row: { updatedAt: string }, now = new Date()): 'Connected' | 'Due soon' | 'Needs re-auth' {
  const idleDays = (now.getTime() - new Date(row.updatedAt).getTime()) / 86400000;
  if (idleDays >= 90) return 'Needs re-auth';
  if (idleDays >= 75) return 'Due soon';
  return 'Connected';
}
