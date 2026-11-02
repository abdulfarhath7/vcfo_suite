/**
 * Library view-model (pure). The real library is the client's saved Ask VCFO
 * answers (`/api/client/library`), grouped by the real topic categories
 * (src/data/ask/schema.ts TOPIC_CATEGORIES). The prototype's look (a5_docs.js
 * BOOKS / TIERS / COVER) is kept: a cover per book, tier 01 as covers, the rest
 * as stacks of slabs.
 */
import type { AnswerEnvelope } from '@/data/ask/schema';

/** Wire shape of GET /api/client/library (src/lib/ask/library.ts LibraryItemView). */
export interface LibraryItem {
  id: string;
  title: string;
  category: string;
  topicSlug: string | null;
  updated: boolean;
  savedAt: string;
  answer: AnswerEnvelope;
}

export interface LibraryFeatures {
  askEnabled: boolean;
  statusBrief: boolean;
}

/** Wire shape of GET /api/client/library/reads. */
export interface LibraryRead {
  ref: string;
  itemId: string | null;
  topicSlug: string | null;
  title: string;
  category: string;
  progressPct: number;
  sectionsRead: number;
  sectionsTotal: number;
  lastReadAt: string;
  finishedAt: string | null;
}

export interface Suggestion {
  slug: string;
  title: string;
  question: string;
}

export interface Cat {
  id: string;
  name: (company: string) => string;
  tab: (company: string) => string;
  /** cover gradient [dark, light] */
  cover: [string, string];
  /** embossed badge on the cover */
  emb: string;
}

/** Fixed order: the firm's topics first, the company's own answers last (prototype: "Northwind’s papers"). */
export const CATS: Cat[] = [
  { id: 'incorporation', name: () => 'Incorporation', tab: () => 'Incorporation', cover: ['#3b1d7a', '#7c3aed'], emb: 'MCA' },
  { id: 'tax', name: () => 'Tax', tab: () => 'Tax', cover: ['#0b3b78', '#1d74d8'], emb: 'TAX' },
  { id: 'compliance', name: () => 'Compliance', tab: () => 'Compliance', cover: ['#21500c', '#5f9e12'], emb: 'SBC' },
  { id: 'foreign-investment', name: () => 'Foreign investment', tab: () => 'Foreign inv.', cover: ['#7a1450', '#d6408f'], emb: 'RBI' },
  { id: 'labour', name: () => 'Labour', tab: () => 'Labour', cover: ['#0b4d47', '#0f8a7e'], emb: 'PAY' },
  { id: 'your-project', name: (c) => `${c}’s project`, tab: (c) => c, cover: ['#1b2540', '#46557d'], emb: 'YOU' },
];

export function catOf(id: string): Cat {
  return CATS.find((c) => c.id === id) ?? CATS[CATS.length - 1]!;
}

export const yearOf = (iso: string): string => iso.slice(0, 4);

/** Short title for a slab (prototype SPINE): drop a trailing year / "— part". */
export function spine(title: string): string {
  return title.replace(/,? \d{4}$/, '').replace(/\s+[—–-]\s+.*$/, '').trim() || title;
}

export interface Tier {
  rank: string;
  name: string;
  /** covers (tier 01) or slabs */
  covers: boolean;
  books: LibraryItem[];
}

/**
 * Tier 01 = the books read most recently (else the latest saved), as covers;
 * then one stack per category for everything else. Tiers are disjoint.
 */
export function tiers(items: LibraryItem[], reads: LibraryRead[], company: string, max = 5): Tier[] {
  const byId = new Map(items.map((b) => [b.id, b]));
  const recent: LibraryItem[] = [];
  for (const r of reads) {
    const b = r.itemId ? byId.get(r.itemId) : items.find((x) => x.topicSlug && x.topicSlug === r.topicSlug);
    if (b && !recent.includes(b)) recent.push(b);
    if (recent.length >= max) break;
  }
  const first = recent.length ? recent : [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, max);
  const out: Tier[] = [];
  if (first.length) out.push({ rank: '01', name: recent.length ? 'Recently read' : 'Latest', covers: true, books: first });
  const rest = items.filter((b) => !first.includes(b));
  let n = out.length;
  for (const c of CATS) {
    const books = rest.filter((b) => (CATS.some((x) => x.id === b.category) ? b.category === c.id : c.id === 'your-project'));
    if (!books.length) continue;
    n += 1;
    out.push({ rank: String(n).padStart(2, '0'), name: c.name(company), covers: false, books: books.sort((a, b) => a.title.localeCompare(b.title)) });
  }
  return out;
}

export function filterBooks(items: LibraryItem[], tab: string, q: string): LibraryItem[] {
  const t = q.trim().toLowerCase();
  return items.filter((b) => (tab === 'all' || catOf(b.category).id === tab) && (!t || `${b.title} ${b.answer.line}`.toLowerCase().includes(t)));
}

/** Reader sections for the table of contents and the reading-progress count. */
export function sectionsOf(a: AnswerEnvelope): string[] {
  const s = ['In short'];
  if (a.visual) s.push(visualTitle(a.visual.type));
  if (a.why) s.push('Why it matters');
  if (a.citations.length) s.push('Sources');
  return s;
}

export function visualTitle(type: string): string {
  switch (type) {
    case 'flow':
      return 'The road';
    case 'steps':
      return 'Step by step';
    case 'compare':
      return 'Side by side';
    case 'timeline':
      return 'Dates';
    case 'keyFacts':
      return 'Key facts';
    case 'nextStep':
      return 'Your next step';
    default:
      return 'Details';
  }
}

/** The official source: the first citation with a link. */
export function officialSource(a: AnswerEnvelope | undefined): { label: string; url: string } | null {
  const c = a?.citations.find((x) => x.url);
  if (!c?.url) return null;
  let host = c.label;
  try {
    host = new URL(c.url).hostname.replace(/^www\./, '');
  } catch {
    /* keep label */
  }
  return { label: host, url: c.url };
}
