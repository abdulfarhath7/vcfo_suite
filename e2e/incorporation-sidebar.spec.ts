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

/** The slug of `pre-1` (the name application), a SPICe+ Part A step of every incorporation. */
const FIRST_PART_A_STEP = 'name-application';

/**
 * Opens a SPICe+ Part A step page of one of this person's clients. A row of the Incorporation
 * grid is not a link: the whole row opens on a click. In the Part A view it opens the client's
 * current Part A step. A person with no client on Part A today (the demo lead's one client is
 * past it) opens a client from the full list and then that client's first Part A step.
 */
async function openPartAStep(page: Page, main: string): Promise<void> {
  const rows = page.locator('main tbody tr');
  const clientRows = page.locator('main tbody tr[tabindex="0"]');

  await page.goto(`${main}?view=part-a`);
  await expect(rows.first()).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => {});
  if (await clientRows.count()) {
    await clientRows.first().click();
  } else {
    await page.goto(main);
    await expect(clientRows.first()).toBeVisible();
    await clientRows.first().click();
    await page.waitForURL(/\/(projects|engagements)\/[^/?#]+$/);
    await page.goto(`${new URL(page.url()).pathname}/step/${FIRST_PART_A_STEP}`);
  }
  // A step page of a client: no list, project or main page address.
  await expect(page).toHaveURL(/\/(projects|engagements)\/[^/]+\/step\/[a-z0-9-]+$/);
}

/** The Incorporation item of the staff sidebar (`SidebarNavGroup` marks each group with its id). */
function incorporationItem(page: Page) {
  return page.locator('[data-sidebar-nav-group^="incorporation:"]');
}

for (const { role, main } of ROLES) {
  test(`${role}: Incorporation in the sidebar returns to the main page from a SPICe+ Part A step`, async ({ page }) => {
    await closeLivePopups(page);
    await login(page, role);
    await openPartAStep(page, main);

    // The sidebar draws the item in one of two ways. As the narrow rail it is one link to the
    // main page. Opened wide it is a dropdown whose first leaf, Overview, is the main page.
    const item = incorporationItem(page);
    const railLink = item.getByRole('link', { name: 'Incorporation', exact: true });
    const group = item.getByRole('button', { name: 'Incorporation', exact: true });
    await expect(railLink.or(group).first()).toBeVisible();

    if (await group.isVisible()) {
      // The group stays highlighted while a page below Incorporation is open.
      await expect(group).toHaveAttribute('data-active', 'true');
      const overview = item.getByRole('link', { name: 'Overview' });
      if (!(await overview.isVisible())) await group.click();
      await overview.click();
    } else {
      // The item stays highlighted while a page below Incorporation is open.
      await expect(railLink).toHaveAttribute('aria-current', 'page');
      await railLink.click();
    }

    await expect(page).toHaveURL((url) => url.pathname === main && url.search === '');
    await expect(page.locator('main').first()).not.toBeEmpty();
  });
}
