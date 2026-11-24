import { createHash } from 'node:crypto';
import type { JsonValue } from './types';

function canonical(value: JsonValue | undefined): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    // A key whose value is undefined is left out, as JSONB leaves it out when the row is stored, so the
    // hash of a draft in memory equals the hash of the same rows read back from Postgres.
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 of what a card proposes: an approval only ever matches this exact content. */
export function changesetHash(rows: ReadonlyArray<{ action: string; target: JsonValue; newValue: JsonValue }>): string {
  const content = rows.map((row) => canonical({ action: row.action, target: row.target, newValue: row.newValue }));
  return createHash('sha256').update(`[${content.join(',')}]`).digest('hex');
}
