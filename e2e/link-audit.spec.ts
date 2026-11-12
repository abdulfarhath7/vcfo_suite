import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { login, type DemoRole } from './helpers/login';

/**
 * NV-04: as each of the five roles, open every sidebar link, breadcrumb segment, card link, button
 * link and notification link, and record the result. The audit starts on the role's home and goes
 * one level deeper: on each page it opens, the breadcrumb and the card links are added too (up to
 * MAX_LINKS per role). The notification links come from the person's own notifications.
 *
 * A link fails when it opens a 404, an error page, a blank page, a page of another role, or a
 * page in a different section from the one the link names (for example a link to
 * /app/lead/incorporation that lands on /app/lead/clients). A redirect inside the same section,
 * such as a project id becoming its slug, passes.
 *
 * The table (role, start page, link, expected page, actual page, result, reason) is written to
 * test-results/link-audit-<role>.csv for the owner. Needs the demo data
 * (`npm run db:seed && npm run db:seed-demo`). Part of `npm run e2e:smoke`.
 */

const ROLES: Array<{ role: DemoRole; segment: string; home: string }> = [
  { role: 'super', segment: '/app/super', home: '/app/super/dashboard' },
  { role: 'admin', segment: '/app/admin', home: '/app/admin/dashboard' },
  { role: 'manager', segment: '/app/manager', home: '/app/manager/dashboard' },
  { role: 'lead', segment: '/app/lead', home: '/app/lead/today' },
  { role: 'client', segment: '/app/client', home: '/app/client/overview' },
];

/** Shells a role may land in. The super admin also works inside the admin shell. */
const ALLOWED: Record<DemoRole, string[]> = {
  // The super admin may enter every workspace (proxy-routes), including the client view and the developer console.
  super: ['/app/super', '/app/admin', '/app/manager', '/app/lead', '/app/client', '/app/dev'],
  admin: ['/app/admin'],
  manager: ['/app/manager'],
  lead: ['/app/lead'],
  client: ['/app/client'],
};

const ERROR_TEXT = /Something went wrong|A temporary error occurred|This page could not be found|404/;

type Row = { role: DemoRole; start: string; link: string; expected: string; actual: string; result: 'Pass' | 'Fail'; why: string };
const rows: Row[] = [];

/** The most links opened per role, so a large demo database still finishes in time. */
const MAX_LINKS = 250;

async function linksOn(page: Page, selector = 'nav a[href^="/app/"], nav[aria-label="Location"] a[href^="/app/"], main a[href^="/app/"]'): Promise<string[]> {
  const hrefs = await page.$$eval(selector, (as) => as.map((a) => a.getAttribute('href') ?? ''));
  return [...new Set(hrefs.map((h) => h.split('#')[0]!).filter(Boolean))];
}

/** The links in the person's own notifications (GL-01 is part of this audit). */
async function notificationLinks(page: Page): Promise<string[]> {
  const body = await page.evaluate(async () => {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    return res.ok ? ((await res.json()) as { notifications?: Array<{ href?: string }> }) : {};
  });
  const hrefs = (body.notifications ?? []).map((n) => (n.href ?? '').split('#')[0]!).filter((h) => h.startsWith('/app/'));
  return [...new Set(hrefs)].slice(0, 40);
}

/**
 * "/app/lead/incorporation/x" -> "incorporation": the section a link names. The role part is left
 * out because the role check above covers it (the super admin also works in the admin shell).
 */
function sectionOf(path: string): string {
  return path.split('?')[0]!.split('/')[3] ?? '';
}

for (const { role, segment, home } of ROLES) {
  test(`every link works for ${role}`, async ({ page }) => {
    test.setTimeout(15 * 60_000);
    await login(page, role);
    await page.goto(home);
    await page.waitForLoadState('networkidle').catch(() => {});
    // The queue: the home's links, then the breadcrumbs and card links of each page opened from
    // the home (one level deeper), then the notification links.
    const queue: Array<{ link: string; start: string; deep: boolean }> = (await linksOn(page)).map((link) => ({ link, start: home, deep: true }));
    expect(queue.length, 'the home page has links').toBeGreaterThan(5);
    for (const link of await notificationLinks(page)) queue.push({ link, start: 'notification', deep: false });
    const seen = new Set<string>();

    while (queue.length && seen.size < MAX_LINKS) {
      const { link, start, deep } = queue.shift()!;
      if (seen.has(link)) continue;
      seen.add(link);
      const res = await page.goto(link, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      const actual = new URL(page.url()).pathname + new URL(page.url()).search;
      const status = res?.status() ?? 0;
      // Wait for the page's own content; some pages nest a second <main>, so read the first.
      await page.locator('main').first().waitFor({ timeout: 15_000 }).catch(() => {});
      await expect(page.locator('main').first()).not.toBeEmpty({ timeout: 15_000 }).catch(() => {});
      const body = (await page.locator('main').first().innerText().catch(() => '')).trim();
      const ownShell = ALLOWED[role].some((s) => actual === s || actual.startsWith(`${s}/`));
      const expected = link.split('?')[0]!;
      const why =
        status >= 400 ? `status ${status}`
        : actual.startsWith('/login') ? 'signed out'
        : !ownShell ? 'page of a different role'
        : !body ? 'blank page'
        : ERROR_TEXT.test(body.slice(0, 400)) ? 'error page'
        : sectionOf(actual) !== sectionOf(expected) ? `wrong page (${actual.split('?')[0]})`
        : '';
      rows.push({ role, start, link, expected, actual, result: why ? 'Fail' : 'Pass', why });

      if (deep && !why) {
        for (const next of await linksOn(page, 'nav[aria-label="Location"] a[href^="/app/"], main a[href^="/app/"]')) {
          if (!seen.has(next)) queue.push({ link: next, start: link, deep: false });
        }
      }
    }
    void segment;
    writeTable(role);
    const failed = rows.filter((r) => r.role === role && r.result === 'Fail');
    expect(failed, failed.map((r) => `${r.link} -> ${r.actual} (${r.why})`).join('\n')).toEqual([]);
  });
}

/** One table per role (the roles run in parallel workers): test-results/link-audit-<role>.csv. */
function writeTable(role: DemoRole) {
  const dir = join(process.cwd(), 'test-results');
  mkdirSync(dir, { recursive: true });
  const csv = ['role,start page,link,expected page,actual page,result,reason']
    .concat(
      rows
        .filter((r) => r.role === role)
        .map((r) => [r.role, r.start, r.link, r.expected, r.actual, r.result, r.why].map((v) => `"${v.replace(/"/g, '""')}"`).join(',')),
    )
    .join('\n');
  writeFileSync(join(dir, `link-audit-${role}.csv`), `${csv}\n`);
}
