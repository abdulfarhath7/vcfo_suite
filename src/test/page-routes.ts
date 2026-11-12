import fs from 'node:fs';
import path from 'node:path';

/*
 * NV-03 test helper: the page routes under `app/app`, read from the folder so a new or removed
 * page is checked without editing a test. The staff and client portal crumb tests share it.
 */
const APP_DIR = path.join(process.cwd(), 'app', 'app');

function readPageRoutes(dir = APP_DIR, prefix = '/app'): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'page.tsx') out.push(prefix);
    if (entry.isDirectory()) out.push(...readPageRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
  }
  return out;
}

/** Every page route, with dynamic segments still in brackets (for example `/app/client/incorporation/phase/[n]`). */
export const PAGE_ROUTES = readPageRoutes();

const ROUTE_RES = PAGE_ROUTES.map((r) => new RegExp(`^${r.replace(/\[[^\]]+\]/g, '[^/]+')}$`));

/** True when a link path (without a query string) opens a page that exists. */
export function isPage(href: string): boolean {
  const p = href.split(/[?#]/)[0]!;
  return ROUTE_RES.some((re) => re.test(p));
}

/** Sample values for the dynamic segments: a slug and a raw id, a real step and a phase number. */
export function routeSamples(route: string): string[] {
  const fill = (id: string) =>
    route
      .replace('[stepId]', 'name-application')
      .replace('[n]', '1')
      .replace(/\[[^\]]+\]/g, id);
  return [...new Set([fill('pexpo-inc'), fill('0c3489fd-fb41-4b22-9e1a-111111111111')])];
}
