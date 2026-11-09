import { expect, test } from '@playwright/test';
import { login } from './helpers/login';

/**
 * Manual first: Request a change is a task button, so it opens the change form in every step state
 * and never the Ask VCFO chat. Kestrel's step pre-1 is complete and no longer with the client, the
 * state that used to send the client to the chat. The test opens the form and cancels, so nothing is
 * sent. Needs a demo database.
 */

test('Request a change opens the form, not the chat, on a step the firm holds', async ({ page }) => {
  await login(page, 'client');
  await page.goto('/app/client/incorporation/step/pre-1');
  await page.getByRole('button', { name: 'Request a change' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Message')).toBeVisible();
  await expect(dialog.getByText('This step is with SBC now.')).toBeVisible();
  await expect(page.locator('#vp-chat')).toBeHidden();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#vp-chat')).toBeHidden();
});
