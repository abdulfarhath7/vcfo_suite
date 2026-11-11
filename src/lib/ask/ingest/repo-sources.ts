import { GLOSSARY as ASK_GLOSSARY } from '@/data/ask/glossary';
import { ASK_PLAYBOOK } from '@/data/ask/playbook';
import { GLOSSARY as FORM_GLOSSARY } from '@/data/glossary';
import { OBLIGATION_TEXTS } from '@/data/obligation-texts';
import { ACT_META, BUILT_IN_FY_KEY, STATUTORY_DEADLINES, type StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import { fyBounds } from '@/lib/statutory-calendar/fy';
import type { Topic } from '@/data/ask/schema';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';

/**
 * The knowledge this repository holds, shaped as search sources with their own chunks: one chunk is
 * one obligation, one act's month or one glossary term, which retrieves far better than cutting the
 * lot by length. Pure, so `scripts/ask-load-knowledge.ts` can load it and a test can read it.
 */
export interface RepoSource {
  title: string;
  sourceType: 'govt' | 'firm_pdf' | 'firm_note';
  audience: 'client' | 'staff' | 'both';
  effectiveFrom?: string;
  effectiveTo?: string;
  chunks: string[];
}

function playbook(): RepoSource {
  const chunks = ASK_PLAYBOOK.split(/^(?=## )/m).map((part) => part.trim());
  return { title: 'Firm playbook', sourceType: 'firm_note', audience: 'both', chunks: chunks.filter(Boolean) };
}

function obligations(): RepoSource {
  const chunks = COMPLIANCE_OBLIGATIONS.flatMap((o) => {
    const text = OBLIGATION_TEXTS[o.id];
    return text ? [`${o.particular}\nAbout: ${text.about}\nWho must file and why it applies: ${text.whyItApplies}\nIf late: ${text.ifLate}`] : [];
  });
  return { title: 'Compliance obligations and late-filing consequences', sourceType: 'firm_note', audience: 'both', chunks };
}

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** One financial year's statutory calendar as a source: one chunk per act per month. */
export function statutoryCalendarSource(fyKey: string, deadlines: readonly StatutoryDeadline[]): RepoSource {
  const fy = fyBounds(fyKey);
  const groups = new Map<string, StatutoryDeadline[]>();
  for (const d of [...deadlines].sort((a, b) => a.date.localeCompare(b.date))) {
    const key = `${d.act}|${d.date.slice(0, 7)}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const chunks = [...groups.entries()].map(([key, items]) => {
    const [act, month] = key.split('|') as [keyof typeof ACT_META, string];
    const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const line = (d: StatutoryDeadline) =>
      `- ${longDate(d.date)}: ${d.actLabel ? `${d.actLabel} ` : ''}${d.title}${d.note ? ` (${d.note})` : ''}`;
    return `${ACT_META[act].label} due dates, ${monthName}\n${items.map(line).join('\n')}`;
  });
  return {
    title: `Statutory compliance calendar ${fy.label}`,
    sourceType: 'firm_pdf',
    audience: 'both',
    effectiveFrom: fy.start,
    effectiveTo: fy.end,
    chunks,
  };
}

function glossary(): RepoSource {
  const terms = new Map<string, string>();
  for (const g of ASK_GLOSSARY) {
    const aliases = g.aliases?.length ? ` (${g.aliases.join(', ')})` : '';
    terms.set(g.term.toLowerCase(), `${g.term}${aliases}: ${g.short}`);
  }
  for (const g of FORM_GLOSSARY) {
    const known = terms.get(g.term.toLowerCase());
    terms.set(g.term.toLowerCase(), known ? `${known} ${g.text} ${g.by}.` : `${g.term}: ${g.text} ${g.by}.`);
  }
  return { title: 'Compliance glossary', sourceType: 'firm_note', audience: 'both', chunks: [...terms.values()] };
}

/**
 * A reviewed topic with no legal-form or residency rule. A restricted topic stays with the topic code,
 * which checks the rule per viewer; a search source has no such check.
 */
function reviewedTopics(topics: readonly Topic[]): RepoSource[] {
  return topics
    .filter((t) => t.status === 'published' && !t.appliesTo.legalForms?.length && !t.appliesTo.residency?.length)
    .map((t) => ({
      title: t.title,
      sourceType: 'firm_note' as const,
      audience: t.audience,
      chunks: [`${t.question}\n${t.body.detail}\nWhy it matters: ${t.body.why}`],
    }));
}

/**
 * Every repository source. `calendars` are the statutory calendars to load, one per financial year;
 * the loader passes what the database holds, and the default is the built-in FY 2026-27 calendar.
 */
export function buildRepoSources(
  topics: readonly Topic[],
  calendars: readonly { fy: string; deadlines: readonly StatutoryDeadline[] }[] = [{ fy: BUILT_IN_FY_KEY, deadlines: STATUTORY_DEADLINES }],
): RepoSource[] {
  return [
    playbook(),
    obligations(),
    ...calendars.map((c) => statutoryCalendarSource(c.fy, c.deadlines)),
    glossary(),
    ...reviewedTopics(topics),
  ];
}
