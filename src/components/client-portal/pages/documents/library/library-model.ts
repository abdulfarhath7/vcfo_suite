import type { AnswerDepth, AnswerEnvelope } from '@/data/ask/schema';
import { dayMonth } from '../file-types';
import type { LibraryItemView } from '@/hooks/ask/ask-api';

/**
 * Library shelves (prototype s/docs/lib_shelf_a.dc.html `CAT`): fixed order,
 * colour, short label and glyph per real Ask VCFO category. Labour is not on
 * the board; it gets its own shelf (inventory G-16). The colours are the
 * Spectrum cover tones from `library-shelf.css` (`--lib-*`), which have their
 * own dark values so the white cover text stays legible.
 */
export interface ShelfCat {
  id: string;
  title: (company: string) => string;
  tab: (company: string) => string;
  short: (company: string) => string;
  color: string;
  icon: string;
  gold?: boolean;
}

export const SHELF_CATS: ShelfCat[] = [
  { id: 'incorporation', title: () => 'Incorporation', tab: () => 'Incorporation', short: () => 'Incorp.', color: 'var(--lib-inc)', icon: 'M4 20h16 M6 20V8l6-4 6 4v12 M10 20v-5h4v5' },
  {
    id: 'foreign-investment',
    title: () => 'Foreign investment',
    tab: () => 'Foreign inv.',
    short: () => 'FDI',
    color: 'var(--lib-fdi)',
    icon: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18',
  },
  { id: 'tax', title: () => 'Tax', tab: () => 'Tax', short: () => 'Tax', color: 'var(--lib-tax)', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2Z M9 9h6 M9 13h6' },
  { id: 'compliance', title: () => 'Compliance', tab: () => 'Compliance', short: () => 'Compliance', color: 'var(--lib-comp)', icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z M8.5 12l2.5 2.5 4.5-4.5' },
  {
    id: 'labour',
    title: () => 'Labour',
    tab: () => 'Labour',
    short: () => 'Labour',
    color: 'var(--lib-labour)',
    icon: 'M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5 M4 15v-3a6 6 0 0 1 6-6 M14 6a6 6 0 0 1 6 6v3',
  },
  {
    id: 'your-project',
    title: (c) => `${c}’s project`,
    tab: (c) => `${c}’s project`,
    short: (c) => `${c}’s project`,
    color: 'var(--lib-project)',
    icon: 'M5 21V4 M5 4h11l-2 4 2 4H5',
    gold: true,
  },
];

export function catOf(id: string): ShelfCat {
  return SHELF_CATS.find((c) => c.id === id) ?? SHELF_CATS[SHELF_CATS.length - 1]!;
}

export function categoryName(id: string, company: string): string {
  return catOf(id).title(company);
}

/** Reader / library links. */
export function readerHref(r: { itemId?: string | null; topicSlug?: string | null }): string {
  if (r.itemId) return `/app/client/library/${encodeURIComponent(r.itemId)}`;
  return `/app/client/learn/${encodeURIComponent(r.topicSlug ?? '')}`;
}

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

export function readTip(r: LibraryRead): string {
  if (r.progressPct >= 100) {
    const d = dayMonth(r.finishedAt ?? r.lastReadAt);
    return `Finished · read on ${d}`;
  }
  return `${r.progressPct}% read · ${r.sectionsRead} of ${r.sectionsTotal} sections`;
}

export async function fetchReads(): Promise<LibraryRead[]> {
  const res = await fetch('/api/client/library/reads', { cache: 'no-store' });
  if (!res.ok) return [];
  return ((await res.json()) as { reads: LibraryRead[] }).reads;
}

export const READS_KEY = ['client-portal', 'library-reads'] as const;
export const LIBRARY_KEY = ['ask', 'library'] as const;

/*
 * Library data comes from /api/client/library/** — NOT the Ask VCFO routes,
 * so saved books, reading progress and the reader work with Ask VCFO off.
 */
export interface LibraryFeatures {
  askEnabled: boolean;
  statusBrief: boolean;
}

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    let msg = fallback;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? fallback;
    } catch {
      /* keep fallback */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function fetchLibrary(): Promise<{ items: LibraryItemView[]; features?: LibraryFeatures }> {
  return json(await fetch('/api/client/library', { cache: 'no-store' }), 'Could not load your library');
}

export async function fetchLibraryItem(id: string): Promise<{ item: LibraryItemView; notice: string | null }> {
  return json(await fetch(`/api/client/library/${encodeURIComponent(id)}`, { cache: 'no-store' }), 'Could not open this item');
}

export async function fetchTopicAnswer(
  slug: string,
  opts: { depth?: AnswerDepth; engagementId?: string | null } = {},
): Promise<{ topic: { slug: string; title: string; category: string; version: number }; answer: AnswerEnvelope }> {
  const params = new URLSearchParams();
  if (opts.depth) params.set('depth', opts.depth);
  if (opts.engagementId) params.set('engagementId', opts.engagementId);
  return json(await fetch(`/api/client/library/topic/${encodeURIComponent(slug)}?${params}`), 'Could not load this explanation');
}

export async function saveToLibrary(body: { engagementId: string; topicSlug?: string; messageId?: string; answer?: AnswerEnvelope }): Promise<{ item: LibraryItemView }> {
  return json(
    await fetch('/api/client/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    'Could not save to your library',
  );
}

export const libraryExportHref = (ids: string[]) => `/api/client/library/export?ids=${encodeURIComponent(ids.join(','))}`;
export const libraryItemExportHref = (id: string) => `/api/client/library/${encodeURIComponent(id)}/export`;
