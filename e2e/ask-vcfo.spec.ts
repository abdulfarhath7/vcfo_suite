import { expect, test } from '@playwright/test';
import { askLauncher, login, openAsk } from './helpers/login';

/**
 * Ask VCFO end to end. Suggestions are deterministic, so none of this needs an
 * API key. Default desktop viewport is 1280 px wide: the panel overlays the
 * page and closes when a go-there link is followed.
 */

const WHERE_NOW = 'Where is my incorporation now?';

// The dev server compiles each route on first visit.
test.describe.configure({ timeout: 180_000 });
/** First answers and first page visits wait on the dev server compiling the route. */
const ANSWER = { timeout: 60_000 };

test.describe('client', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'client');
  });

  test('launcher, Ctrl+J and Esc', async ({ page }) => {
    const launcher = askLauncher(page);
    await expect(launcher).toBeVisible({ timeout: 30_000 });
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Control+j');
    await expect(page.getByRole('complementary', { name: 'Ask VCFO' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'Ask VCFO' })).toBeHidden();
  });

  test('home shows the two project questions', async ({ page }) => {
    const panel = await openAsk(page);
    await expect(panel.getByRole('button', { name: 'What is my next step?' })).toBeVisible();
    await expect(panel.getByRole('button', { name: WHERE_NOW })).toBeVisible();
  });

  test('where-now answer, go-there link, focus pulse and back pill', async ({ page }) => {
    const panel = await openAsk(page);
    await panel.getByRole('button', { name: WHERE_NOW }).click();
    await expect(panel.locator('[data-visual="flow"]')).toBeVisible(ANSWER);
    await expect(panel.getByText(/steps are complete|All incorporation steps are complete/)).toBeVisible();
    // Built from the project's own gate, so it carries the firm badge; topic
    // answers carry "Not yet reviewed" while topics are drafts (next test).
    await expect(panel.getByText(/Reviewed by/)).toBeVisible();

    await panel.getByRole('link', { name: 'Open Incorporation' }).click();
    await expect(page).toHaveURL(/\/app\/client\/incorporation/, ANSWER);
    // The focused row (the step, or its phase row) pulses once…
    await expect(page.locator('[data-ask-focus].ask-focus-pulse, [data-ask-focus].ask-focus-ring').first()).toBeVisible(ANSWER);
    // …and the arrival params are removed so a refresh does not re-pulse.
    await expect(page).not.toHaveURL(/focus=|from=ask/);

    // 1280 px: the panel closed on navigation and the pill brings it back.
    await expect(page.getByRole('complementary', { name: 'Ask VCFO' })).toBeHidden();
    const pill = page.getByRole('button', { name: 'Back to Ask VCFO' });
    await expect(pill).toBeVisible();
    await pill.click();
    const reopened = page.getByRole('complementary', { name: 'Ask VCFO' });
    await expect(reopened).toBeVisible();
    await expect(reopened.locator('[data-visual="flow"]')).toBeVisible();
  });

  test('topic answer saves to the library', async ({ page }) => {
    const panel = await openAsk(page);
    await panel.getByRole('button', { name: 'What is GST, and do we need it?' }).click();
    await expect(panel.getByText('Not yet reviewed')).toBeVisible(ANSWER);
    await panel.getByRole('button', { name: 'Save to library' }).click();
    await expect(panel.getByText('Saved to library')).toBeVisible();
    await page.goto('/app/client/library');
    await expect(page.getByRole('heading', { name: 'GST basics' })).toBeVisible(ANSWER);
  });

  test('an off-topic question is refused', async ({ page }) => {
    const panel = await openAsk(page);
    await panel.locator('#ask-composer').fill('write me a python script');
    await panel.getByRole('button', { name: 'Send' }).click();
    // With a model key the guard refuses; without one Ask VCFO says it is
    // unavailable. Either way it never answers the question.
    await expect(
      panel.getByText(/I can only help with your company setup|Ask VCFO is unavailable right now/),
    ).toBeVisible({ timeout: 45_000 });
  });

  test('opens as a bottom sheet on a phone @mobile', async ({ page }) => {
    const launcher = askLauncher(page);
    await expect(launcher).toBeVisible({ timeout: 30_000 });
    await launcher.click();
    const sheet = page.getByRole('dialog', { name: 'Ask VCFO' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: WHERE_NOW })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Ask VCFO' })).toHaveCount(0);
  });
});

test('admin: waiting-on-clients rows link into a project', async ({ page }) => {
  await login(page, 'admin');
  const panel = await openAsk(page);
  await panel.getByRole('button', { name: 'Which projects are waiting on clients?' }).click();
  const rows = panel.locator('[data-visual="projectRows"] a');
  await expect(rows.first()).toBeVisible(ANSWER);
  await rows.first().click();
  await expect(page).toHaveURL(/\/app\/admin\/projects\//, ANSWER);
});

test('super admin: preview Ask VCFO as a client', async ({ page }) => {
  await login(page, 'super');
  const panel = await openAsk(page);
  await panel.getByRole('button', { name: 'Preview Ask VCFO as a client' }).click();
  await expect(panel.getByLabel('Find a client')).toBeVisible(ANSWER);
  await panel.locator('ul li button').first().click();
  await expect(page.locator('#ask-panel').getByText(/^Client view · /)).toBeVisible();
  await expect(page.locator('#ask-panel').getByRole('button', { name: 'Exit preview' })).toBeVisible();
});

for (const role of ['manager', 'lead'] as const) {
  test(`${role}: no launcher and the API refuses`, async ({ page }) => {
    await login(page, role);
    await page.waitForLoadState('networkidle');
    await expect(askLauncher(page)).toHaveCount(0);
    const res = await page.request.get('/api/ask/suggestions?shell=client');
    expect(res.status()).toBe(403);
  });
}
