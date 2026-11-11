import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { demoEngagementId, login, onLocalDb } from './helpers/login';

/**
 * GL-07 on a running app: a card's email goes out only from the "Send email" pop-up. Cancel sends
 * nothing and changes nothing; Send sends the text the person wrote, not the template. When the
 * server runs with the UAT mail catcher (e2e/uat/tools/mail-catcher.mjs), the caught email is
 * checked too. Makes a draft request list for Kestrel, so it runs on a local database only.
 */

let KESTREL = '';
const MAIL = join(process.cwd(), 'e2e/uat/results/mail.jsonl');

function caughtSince(since: string): Array<{ subject: string; text?: string; html?: string; to: string | string[] }> {
  if (!existsSync(MAIL)) return [];
  return readFileSync(MAIL, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { at: string; subject: string; text?: string; html?: string; to: string | string[] })
    .filter((m) => m.at >= since);
}

let local = false;
test.beforeAll(async () => {
  await onLocalDb(async () => {
    local = true;
  });
  KESTREL = await demoEngagementId('demo-kestrel-robotics');
});

test('a request list goes out only from the pop-up, with the edited words', async ({ page }) => {
  test.skip(!local, 'needs the local demo database');
  test.setTimeout(180_000);
  const since = new Date().toISOString();
  await login(page, 'lead');

  const created = await page.request.post('/api/request-lists', {
    data: { engagementId: KESTREL, title: `GL-07 check ${Date.now()}`, items: [{ kind: 'document', label: 'Bank statement' }] },
  });
  expect(created.status()).toBeLessThan(300);
  const listId = ((await created.json()) as { list: { id: string } }).list.id;

  // Without the pop-up's Send, the route refuses and nothing is sent.
  const bare = await page.request.post(`/api/request-lists/${listId}/send`, { data: { confirm: true } });
  expect(bare.status()).toBe(400);

  await page.goto(`/app/lead/requests?list=${listId}`);
  await page.getByRole('button', { name: 'Send to client' }).click();
  await page.getByRole('button', { name: 'Write the email' }).click();
  const dialog = page.getByTestId('send-email-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('To')).not.toHaveValue('');

  // Cancel: the list stays a draft.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  const still = (await (await page.request.get(`/api/request-lists/${listId}`)).json()) as { list: { status: string } };
  expect(still.list.status).toBe('draft');

  // Send with the person's own words and subject.
  await page.getByRole('button', { name: 'Write the email' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Subject').fill('Documents for this quarter');
  await dialog.getByLabel('Message').fill('Hello team, please upload the bank statement by Friday. Thank you.');
  await dialog.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  const sent = (await (await page.request.get(`/api/request-lists/${listId}`)).json()) as { list: { status: string } };
  expect(sent.list.status).toBe('sent');

  const mail = caughtSince(since).find((m) => m.subject === 'Documents for this quarter');
  if (existsSync(MAIL)) {
    expect(mail, 'the caught email').toBeTruthy();
    expect(mail!.text).toContain('please upload the bank statement by Friday');
    expect(mail!.text).not.toContain('We need the items below');
  }
});

test('the client reminder sends nothing without the pop-up', async ({ page }) => {
  test.skip(!local, 'needs the local demo database');
  await login(page, 'lead');
  const url = `/api/engagements/${KESTREL}/remind`;
  const preview = await page.request.post(url, { data: { itemKey: `step:${KESTREL}:pre-15`, preview: true } });
  if (preview.status() === 429) return; // already reminded today on this database
  expect(preview.status()).toBe(200);
  const draft = ((await preview.json()) as { draft: { to: string[]; subject: string; message: string } }).draft;
  expect(draft.to.length).toBeGreaterThan(0);
  expect(draft.message).toMatch(/waiting on you/);
  const bare = await page.request.post(url, { data: { itemKey: `step:${KESTREL}:pre-15` } });
  expect(bare.status()).toBe(400);
});
