/**
 * Portal links → portal intents. Notifications, audit events and Ask VCFO
 * answers carry `/app/client/**` paths (the routes of the previous portal,
 * still used by emails). Inside the one-page portal those paths are not page
 * loads: each maps to the same intent its route page sends (see
 * app/app/client/**\/page.tsx and Intent.tsx), so a click scrolls to the
 * section or opens the step / filing / reader in place.
 *
 * Pure: unit-tested in links.test.ts.
 */
import type { Intent, SectionKey } from '../../runtime';

const BASE = '/app/client';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Phase keys the step pages and emails use (same table as the phase route page). */
const PHASE_KEYS: Record<string, number> = {
  'pre-inc-phase-1': 1,
  'pre-inc-phase-2': 2,
  'post-inc-phase-3': 3,
  'registration-phase-4': 4,
  'part-a': 1,
  'part-b': 2,
  'post-incorporation': 3,
  registration: 4,
};

const SECTION_PATHS: Record<string, SectionKey> = {
  '': 'home',
  '/overview': 'home',
  '/messages': 'home',
  '/incorporation': 'incorporation',
  '/progress': 'incorporation',
  '/compliances': 'calendar',
  '/compliances/calendar': 'calendar',
  '/compliances/filings': 'filings',
  '/documents': 'documents',
  '/credentials': 'credentials',
  '/library': 'library',
  '/team': 'team',
  '/audit': 'audit',
  '/settings': 'settings',
};

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The intent a portal path stands for, or null when it is not a client-portal path. */
export function hrefToIntent(href: string): Intent | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'http://portal.local');
  } catch {
    return null;
  }
  if (url.origin !== 'http://portal.local' && !href.startsWith('/')) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path !== BASE && !path.startsWith(BASE + '/')) return null;
  const rest = path.slice(BASE.length);

  // old email links: ?step=pre-13 on any page, ?filing= / ?open= on the compliance pages
  const step = url.searchParams.get('step');
  if (step) return { kind: 'step', stepId: step };
  const filing = url.searchParams.get('filing') ?? url.searchParams.get('open');
  if (filing && UUID.test(filing) && rest.startsWith('/compliances')) return { kind: 'filing', id: filing };

  if (rest in SECTION_PATHS) return { kind: 'section', key: SECTION_PATHS[rest]! };

  let m = rest.match(/^\/incorporation\/step\/([^/]+)$/);
  if (m) return { kind: 'step', stepId: decode(m[1]!) };
  m = rest.match(/^\/incorporation\/phase\/([^/]+)$/);
  if (m) {
    const raw = decode(m[1]!);
    const n = PHASE_KEYS[raw] ?? Number.parseInt(raw, 10);
    return { kind: 'phase', phaseNo: n >= 1 && n <= 4 ? n : 1 };
  }
  if (rest === '/board-resolution') return { kind: 'board' };
  if (rest === '/notifications') return { kind: 'notes' };
  if (rest === '/announcements') return { kind: 'anns' };
  m = rest.match(/^\/library\/([^/]+)$/);
  if (m) return { kind: 'reader', mode: 'saved', id: decode(m[1]!) };
  m = rest.match(/^\/learn\/([^/]+)$/);
  if (m) return { kind: 'reader', mode: 'learn', id: decode(m[1]!) };
  return null;
}

/** The `#hash` of a link, without the `#` ('' when none). */
export function hrefHash(href: string): string {
  const i = href.indexOf('#');
  return i >= 0 ? href.slice(i + 1) : '';
}
