import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { login, type DemoRole } from './helpers/login';

/**
 * NV-04: open every sidebar link, every breadcrumb segment and the main buttons and card links of
 * each role's home, as each of the five roles, and record the result. A link fails when it opens a
 * 404, an error page, a blank page, or a page of another role. The table (role, start page, link,
 * expected page, actual page, result) is written to test-results/link-audit.csv for the owner.
 *
 * Needs the demo data (`npm run db:seed && npm run db:seed-demo`). Part of `npm run e2e:smoke`.
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

async function linksOn(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval(
    'nav a[href^="/app/"], nav[aria-label="Location"] a[href^="/app/"], main a[href^="/app/"]',
    (as) => as.map((a) => a.getAttribute('href') ?? ''),
  );
  return [...new Set(hrefs.map((h) => h.split('#')[0]!).filter(Boolean))];
}

for (const { role, segment, home } of ROLES) {
  test(`every link works for ${role}`, async ({ page }) => {
    test.setTimeout(15 * 60_000);
    await login(page, role);
    await page.goto(home);
    await page.waitForLoadState('networkidle').catch(() => {});
    const links = await linksOn(page);
    expect(links.length, 'the home page has links').toBeGreaterThan(5);

    for (const link of links) {
      const res = await page.goto(link, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      const actual = new URL(page.url()).pathname + new URL(page.url()).search;
      const status = res?.status() ?? 0;
      // Wait for the page's own content; some pages nest a second <main>, so read the first.
      await page.locator('main').first().waitFor({ timeout: 15_000 }).catch(() => {});
      await expect(page.locator('main').first()).not.toBeEmpty({ timeout: 15_000 }).catch(() => {});
      const body = (await page.locator('main').first().innerText().catch(() => '')).trim();
      const ownShell = ALLOWED[role].some((s) => actual === s || actual.startsWith(`${s}/`));
      const why =
        status >= 400 ? `status ${status}`
        : actual.startsWith('/login') ? 'signed out'
        : !ownShell ? 'page of a different role'
        : !body ? 'blank page'
        : ERROR_TEXT.test(body.slice(0, 400)) ? 'error page'
        : '';
      rows.push({ role, start: home, link, expected: link.split('?')[0]!, actual, result: why ? 'Fail' : 'Pass', why });
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
