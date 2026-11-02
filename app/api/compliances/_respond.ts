import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ComplianceTaskError } from '@/db/repositories/compliance-tasks';
import { ActivityError } from '@/db/repositories/compliance-activities';

/**
 * Shared parts of the /api/compliances routes (docs/ui-port/COMPLIANCE-API.md): the error
 * mapping and the field schemas. Repository errors carry their HTTP status and a short code.
 */
export function complianceError(e: unknown) {
  if (e instanceof ComplianceTaskError || e instanceof ActivityError) {
    return NextResponse.json({ error: e.code }, { status: e.status });
  }
  console.error('[compliances] route failed', e instanceof Error ? e.message : e);
  return NextResponse.json({ error: 'server_error' }, { status: 500 });
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');
export const stage = z.enum(['not-started', 'ready', 'in-progress', 'waiting', 'review', 'rework', 'completed', 'not-applicable']);
export const urgency = z.enum(['Low', 'Medium', 'High', 'Critical']);
export const visibility = z.enum(['firm', 'client', 'both']);
export const repeats = z.enum(['one-time', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']);
export const reminderKey = z.enum(['initial', 'due-soon', 'due-date', 'overdue', 'escalate-reviewer', 'escalate-admin']);
export const profileId = z.string().uuid();

/** A comma list from the query string, kept to the allowed values. */
export function listParam<T extends string>(params: URLSearchParams, name: string, allowed: readonly T[]): T[] | undefined {
  const raw = params.get(name);
  if (!raw) return undefined;
  const set = new Set<string>(allowed);
  const out = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is T => set.has(s));
  return out.length ? out : undefined;
}
