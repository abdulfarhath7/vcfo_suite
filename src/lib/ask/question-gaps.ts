/**
 * A1 question gaps (§9A): group the client questions that Ask VCFO had to
 * generate an answer for, or that were handed to a lead, so the firm can see
 * which reviewed topics are missing. Pure — no db, no model.
 */
export interface GapQuestion {
  question: string;
  askedAt: string;
  source: 'generated' | 'handoff';
  /** Only ever set for a super admin viewer. */
  companyName: string | null;
}

export interface GapGroup {
  question: string;
  count: number;
  lastAskedAt: string;
  generated: number;
  handoffs: number;
  examples: string[];
  /** Distinct companies — empty unless the viewer is a super admin. */
  companies: string[];
}

const STOP = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'do', 'does', 'did', 'we', 'i', 'you', 'our', 'my', 'us', 'it', 'to', 'of', 'for',
  'in', 'on', 'and', 'or', 'what', 'how', 'why', 'when', 'which', 'who', 'can', 'should', 'would', 'will', 'need', 'have',
  'has', 'be', 'this', 'that', 'with', 'about', 'please', 'me', 'tell', 'explain',
]);

export function questionTokens(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9+-]+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** Jaccard similarity of two questions' meaningful words. */
export function questionSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export const GAP_SIMILARITY_THRESHOLD = 0.5;

/** How far back the gaps page looks. */
export const GAPS_WINDOW_DAYS = 30;

/** Greedy clustering, newest first; the newest question names its group. */
export function groupQuestions(rows: readonly GapQuestion[], threshold = GAP_SIMILARITY_THRESHOLD): GapGroup[] {
  const sorted = [...rows].filter((r) => r.question.trim()).sort((a, b) => b.askedAt.localeCompare(a.askedAt));
  const groups: Array<GapGroup & { tokens: Set<string> }> = [];
  for (const row of sorted) {
    const tokens = questionTokens(row.question);
    const match = groups.find((g) => questionSimilarity(g.tokens, tokens) >= threshold);
    if (match) {
      match.count += 1;
      if (row.source === 'generated') match.generated += 1;
      else match.handoffs += 1;
      if (match.examples.length < 3 && !match.examples.includes(row.question)) match.examples.push(row.question);
      if (row.companyName && !match.companies.includes(row.companyName)) match.companies.push(row.companyName);
      continue;
    }
    groups.push({
      question: row.question,
      count: 1,
      lastAskedAt: row.askedAt,
      generated: row.source === 'generated' ? 1 : 0,
      handoffs: row.source === 'handoff' ? 1 : 0,
      examples: [row.question],
      companies: row.companyName ? [row.companyName] : [],
      tokens,
    });
  }
  return groups
    .sort((a, b) => b.count - a.count || b.lastAskedAt.localeCompare(a.lastAskedAt))
    .map(({ tokens: _tokens, ...group }) => group);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
      .replace(/-$/, '') || 'new-topic'
  );
}

/**
 * A draft topic file for a question group. It passes the topic schema so it
 * can be added under src/data/ask/topics by pull request; every text field is
 * a placeholder for the firm to write and review.
 */
export function draftTopicFor(question: string): Record<string, unknown> {
  const clean = question.trim().replace(/\s+/g, ' ').slice(0, 200);
  return {
    slug: slugify(clean),
    title: clean.replace(/\?+$/, '').slice(0, 160),
    question: clean,
    category: 'your-project',
    audience: 'client',
    appliesTo: { legalForms: [], residency: [] },
    body: {
      normal: 'Write the answer here in one to three plain sentences.',
      simple: 'Write a one-sentence version with no jargon.',
      detail: 'Write the fuller explanation here, up to about six sentences.',
      why: 'Write why this matters to the client.',
    },
    citations: [{ id: 'add-a-source', label: 'Add the rule or source this answer relies on' }],
    related: [],
    status: 'draft',
    version: 1,
  };
}

/** Client panel footer line shown while A1 is on (§9A.1). Wording is the owner's to change. */
export const ASK_VISIBILITY_NOTICE = 'Your firm can see questions you ask here, to help you better.';
