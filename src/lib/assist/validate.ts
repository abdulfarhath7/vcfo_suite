import { getActiveCatalogItems } from '@/data/checklist';
import {
  answerEnvelopeSchema,
  CLIENT_VISUAL_TYPES,
  STAFF_VISUAL_TYPES,
  type AnswerEnvelope,
  type AssistShell,
  type Visual,
} from '@/data/assist/schema';

/**
 * Code-side answer checks (VCFO-ASSIST-CONTEXT §6.6). The model never gets
 * the last word on: schema, which sources it cites, any date it states, step
 * ids it points at, and which visuals a persona may receive.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

function validDay(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Every calendar date in `text`, normalised: `YYYY-MM-DD` when a year is
 * present, `--MM-DD` when only day and month are. Durations ("30 days") and
 * bare years are not dates.
 */
export function extractDates(text: string): string[] {
  const out = new Set<string>();
  const add = (y: number | null, m: number, d: number) => {
    if (!validDay(m, d)) return;
    out.add(y ? `${y}-${pad(m)}-${pad(d)}` : `--${pad(m)}-${pad(d)}`);
  };
  let consumed = text;
  const take = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    consumed = consumed.replace(re, (...args) => {
      fn(args.slice(0, -2) as unknown as RegExpExecArray);
      return ' ';
    });
  };
  take(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => add(Number(m[1]), Number(m[2]), Number(m[3])));
  take(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, (m) => add(Number(m[3]), Number(m[2]), Number(m[1])));
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?,?\\s+(\\d{4})\\b`, 'gi'), (m) =>
    add(Number(m[3]), monthIndex(m[2]!), Number(m[1])),
  );
  take(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'), (m) =>
    add(Number(m[3]), monthIndex(m[1]!), Number(m[2])),
  );
  take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'gi'), (m) =>
    add(null, monthIndex(m[2]!), Number(m[1])),
  );
  take(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'), (m) =>
    add(null, monthIndex(m[1]!), Number(m[2])),
  );
  return [...out];
}

/** Dates the answer may state: exactly those in this turn's tool results. */
export function allowedDates(toolResultTexts: readonly string[]): Set<string> {
  const allowed = new Set<string>();
  for (const text of toolResultTexts) {
    for (const d of extractDates(text)) {
      allowed.add(d);
      if (!d.startsWith('--')) allowed.add(`--${d.slice(5)}`);
    }
  }
  return allowed;
}

function visualText(visual: Visual | undefined): string {
  return visual ? JSON.stringify(visual) : '';
}

export interface ValidationContext {
  shell: AssistShell;
  /** Chunk ids, topic slugs / topic citation ids, and tool names of this turn. */
  allowedCitationIds: ReadonlySet<string>;
  toolResultTexts: readonly string[];
}

export type ValidationResult = { ok: true; answer: AnswerEnvelope } | { ok: false; errors: string[] };

const STEP_ID_RE = /\b(?:pre|post|reg)-\d+\b/g;

export function validateAnswer(raw: unknown, ctx: ValidationContext): ValidationResult {
  const parsed = answerEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.slice(0, 5).map((i) => `schema: ${i.path.join('.')} ${i.message}`),
    };
  }
  const answer = parsed.data;
  const errors: string[] = [];

  if (answer.visual) {
    const allowed = ctx.shell === 'client' ? CLIENT_VISUAL_TYPES : STAFF_VISUAL_TYPES;
    if (!allowed.includes(answer.visual.type)) errors.push(`visual ${answer.visual.type} is not allowed here`);
  }

  for (const c of answer.citations) {
    if (!ctx.allowedCitationIds.has(c.id)) errors.push(`citation ${c.id} was not retrieved or called this turn`);
  }

  const dates = allowedDates(ctx.toolResultTexts);
  const text = `${answer.line}\n${answer.why ?? ''}\n${visualText(answer.visual)}`;
  for (const d of extractDates(text)) {
    if (!dates.has(d)) errors.push(`date ${d} does not come from the calendar or checklist`);
  }

  const active = new Set(getActiveCatalogItems().map((i) => i.id));
  for (const id of text.match(STEP_ID_RE) ?? []) {
    if (!active.has(id)) errors.push(`step ${id} is not in the active checklist`);
  }
  if (answer.visual?.type === 'nextStep' && !active.has(answer.visual.stepId)) {
    errors.push(`nextStep ${answer.visual.stepId} is not in the active checklist`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, answer };
}

/** An envelope without its visual — the text-only fallback for a bad visual. */
export function withoutVisual(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const { visual: _drop, ...rest } = raw as Record<string, unknown>;
  return rest;
}
