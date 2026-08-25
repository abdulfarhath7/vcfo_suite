import { expect, test } from '@playwright/test';

test('intern Today lists managers and opens compose with to=', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('intern@vcfo.local');
  await page.getByLabel('Password').fill('intern123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app\/intern\/today/);

  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'My managers' }) });
  await expect(card.getByRole('heading', { name: 'My managers' })).toBeVisible();
  await expect(card.getByText('Project Manager')).toBeVisible();
  await expect(card.getByText('manager@vcfo.local')).toBeVisible();

  await card.getByRole('link', { name: 'Email Project Manager' }).click();
  await expect(page).toHaveURL(/\/app\/intern\/mail\?to=manager%40vcfo\.local/);
});
