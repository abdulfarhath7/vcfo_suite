import { expect, test, type Page } from '@playwright/test';
import { closeLivePopups, login, type DemoRole } from './helpers/login';

/**
 * NV-02: from a SPICe+ Part A step, one click on the sidebar's Incorporation item (its Overview
 * leaf, since NV-01 made it a dropdown) opens the role's Incorporation main page. The address is
 * the main page's own, with no client or step left in it, and the item stays highlighted on the
 * step page. Same result for the Lead, the Manager and the Admin.
 *
 * Needs the demo data (`npm run db:seed && npm run db:seed-demo`).
 */

const ROLES: Array<{ role: DemoRole; main: string }> = [
  { role: 'lead', main: '/app/lead/incorporation' },
  { role: 'manager', main: '/app/manager/incorporation' },
  { role: 'admin', main: '/app/admin/incorporation' },
];

/** The first SPICe+ Part A step page this person can open, found from the Part A list. */
async function openPartAStep(page: Page, main: string): Promise<void> {
  await page.goto(`${main}?view=part-a`);
  await page.waitForLoadState('networkidle').catch(() => {});
  const stepLink = page.locator('main a[href*="/step/pre-"]').first();
  if (await stepLink.count()) {
    await stepLink.click();
  } else {
    // The list links to projects; the project page links to its steps.
    await page.locator('main a[href*="/projects/"], main a[href*="/engagements/"]').first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('main a[href*="/step/pre-"]').first().click();
  }
  await expect(page).toHaveURL(/\/step\/pre-/);
}

function sidebar(page: Page) {
  return page.getByRole('navigation').filter({ has: page.getByRole('button', { name: /Incorporation/ }) }).first();
}

for (const { role, main } of ROLES) {
  test(`${role}: Incorporation in the sidebar returns to the main page from a SPICe+ Part A step`, async ({ page }) => {
    await closeLivePopups(page);
    await login(page, role);
    await openPartAStep(page, main);

    const nav = sidebar(page);
    const group = nav.getByRole('button', { name: /Incorporation/ });
    // The group stays highlighted while a page below Incorporation is open.
    await expect(group).toHaveAttribute('data-active', 'true');

    const overview = nav.getByRole('link', { name: 'Overview' });
    if (!(await overview.isVisible())) await group.click();
    await overview.click();

    await expect(page).toHaveURL((url) => url.pathname === main && url.search === '');
    await expect(page.locator('main').first()).not.toBeEmpty();
  });
}
