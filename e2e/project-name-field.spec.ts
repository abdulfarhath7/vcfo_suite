import { expect, test } from '@playwright/test';
import { closeLivePopups, login } from './helpers/login';

/**
 * PR-01: the project name field kept the cursor for one letter only, because the first letter
 * swapped the input for a title button. A person must be able to type a whole name in one go.
 */
const NAME = 'Zenith Robotics India Private Limited Co'; // 40 characters

test('the project name field keeps the cursor for a 40-character name', async ({ page }) => {
  expect(NAME).toHaveLength(40);
  await closeLivePopups(page);
  await login(page, 'admin');
  await page.goto('/app/admin/projects/new');
  await page.evaluate(() => window.localStorage.removeItem('vcfo.create-project.draft.v3'));
  await page.reload();

  const field = page.locator('#create-company-name');
  await field.click();
  // One key at a time, with no second click: the field must still be the focused element.
  for (const letter of NAME) {
    await page.keyboard.type(letter);
    await expect(field).toBeFocused();
  }
  await expect(field).toHaveValue(NAME);

  // Enter leaves the field and shows the same text as the title.
  await page.keyboard.press('Enter');
  await expect(page.locator('button[title="Edit project name"]')).toHaveText(NAME);

  await page.evaluate(() => window.localStorage.removeItem('vcfo.create-project.draft.v3'));
});
