import { expect, test } from '@playwright/test';
import { login, type DemoRole } from './helpers/login';

/**
 * Staff sidebar rail (R-49, R-51): every nav icon sits in the same column, the nav scrolls on a
 * 768 px tall screen, and Incorporation is on every practice rail. Needs `npm run db:seed-demo`.
 */
const ROLES: DemoRole[] = ['admin', 'manager', 'lead', 'super'];

for (const role of ROLES) {
  test(`rail icons line up for ${role}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await login(page, role);
    await page.getByRole('button', { name: 'Collapse sidebar' }).first().click();
    await page.mouse.move(900, 400);
    const nav = page.locator('aside nav').first();
    await expect(nav.getByRole('link', { name: /^Incorporation/ })).toHaveCount(1);
    const centres = await nav
      .locator('a svg, button svg')
      .evaluateAll((els) =>
        els
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width >= 16)
          .map((r) => r.left + r.width / 2),
      );
    expect(centres.length).toBeGreaterThan(5);
    const first = centres[0];
    for (const x of centres) expect(Math.abs(x - first)).toBeLessThanOrEqual(1);
    const scroll = await nav.evaluate((n) => ({ y: getComputedStyle(n).overflowY, fits: n.scrollHeight <= n.clientHeight }));
    expect(scroll.fits || scroll.y === 'auto' || scroll.y === 'scroll').toBe(true);
  });
}
