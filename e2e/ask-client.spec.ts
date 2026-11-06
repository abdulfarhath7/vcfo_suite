import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, onLocalDb, openClientChat } from './helpers/login';

/**
 * Ask VCFO's Do engine as a client, in the portal's own chat window: a paste becomes a card only for
 * fields the client owns, a file finds its open request with no reading, and nothing reaches another
 * company. Labelled lines and file names are read by code, so no model runs. Needs S3 or MinIO, and a
 * demo database. The test works on Kestrel and puts the demo state back afterwards.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });

const SLUG = 'demo-kestrel-robotics';
const OTHER_CLIENT = process.env.E2E_OTHER_CLIENT_EMAIL ?? 'client-alderson@demo.vcfo.local';
const PDF = readFileSync(path.resolve('tests/ask/evals/fill/fixtures/intro-letter.pdf'));
const REQUEST_TITLE = 'E2E rent agreement';

let saved: unknown = null;
let cardId = '';

test.beforeAll(async () => {
  await onLocalDb(async (db) => {
    const { rows } = await db.query('select id, checklist_state from engagements where slug = $1', [SLUG]);
    saved = rows[0].checklist_state;
    await db.query(`update engagements set checklist_state = checklist_state - 'pre-15' where slug = $1`, [SLUG]);
    await db.query(`insert into document_requests (engagement_id, title, status) values ($1, $2, 'pending')`, [rows[0].id, REQUEST_TITLE]);
  });
});

test.afterAll(async () => {
  await onLocalDb(async (db) => {
    await db.query('update engagements set checklist_state = $2 where slug = $1', [SLUG, JSON.stringify(saved)]);
    await db.query('delete from document_requests where title = $1', [REQUEST_TITLE]);
  });
});

const preFifteen = async () => {
  let responses: Record<string, string> = {};
  await onLocalDb(async (db) => {
    const { rows } = await db.query(`select checklist_state->'pre-15'->'responses' as responses from engagements where slug = $1`, [SLUG]);
    responses = rows[0].responses ?? {};
  });
  return responses;
};

const requestStatus = async () => {
  let status = '';
  await onLocalDb(async (db) => {
    const { rows } = await db.query('select status from document_requests where title = $1', [REQUEST_TITLE]);
    status = rows[0].status;
  });
  return status;
};

async function clientChat(page: Page): Promise<Locator> {
  await login(page, 'client');
  await page.goto('/app/client/overview');
  await page.waitForLoadState('domcontentloaded');
  return openClientChat(page);
}

async function paste(chat: Locator, text: string) {
  const input = chat.getByRole('textbox', { name: 'Type a question' });
  await input.fill(text);
  await input.press('Enter');
}

test('a pasted answer makes a card, saves on accept and comes back off on undo', async ({ page }) => {
  const chat = await clientChat(page);
  const loaded = page.waitForResponse((response) => /\/api\/ask\/changesets\/[0-9a-f-]+$/.test(response.url()) && response.ok(), { timeout: 90_000 });
  await paste(chat, 'Name: Asha Rao\nPAN: ABCPR1234F');

  const card = chat.locator('section[aria-label^="Details for"]');
  await expect(card).toBeVisible({ timeout: 90_000 });
  cardId = /changesets\/([0-9a-f-]+)$/.exec((await loaded).url())![1]!;
  await expect(chat).toContainText('Nothing is saved until you accept');
  await expect(card).toContainText('XXXXXX234F');
  await expect(chat).not.toContainText('ABCPR1234F');
  expect(await preFifteen()).toEqual({});

  await card.getByRole('button', { name: 'Accept all clear rows' }).click();
  await card.getByRole('button', { name: /^Save accepted/ }).click();
  await expect(card.getByRole('button', { name: 'Undo' })).toBeVisible({ timeout: 60_000 });

  const after = await preFifteen();
  const [entry] = (after.directors ?? '').split(',');
  expect(after[`directors.${entry}.firstName`]).toBe('Asha');
  expect(after[`directors.${entry}.lastName`]).toBe('Rao');
  // The screen's own condition holds the PAN until residence is answered, for a client as for staff.
  expect(after[`directors.${entry}.panNumber`] ?? '').toBe('');

  await card.getByRole('button', { name: 'Undo' }).click();
  await expect(card.getByTestId('changeset-row').filter({ hasText: /first name/i })).toContainText('Undone', { timeout: 60_000 });
  const undone = await preFifteen();
  expect(undone[`directors.${entry}.firstName`] ?? '').toBe('');
});

test('what the firm fills never reaches a client\'s card', async ({ page }) => {
  const chat = await clientChat(page);
  await paste(chat, 'NIC code: 62011\nBusiness type: Software');
  await expect(chat.getByText(/Your project lead fills "Main NIC code", so I left it out/)).toBeVisible({ timeout: 90_000 });
  await expect(chat.locator('section[aria-label^="Details for"]')).toHaveCount(0);
});

test('naming another company reads nothing, and another client cannot open this one\'s card', async ({ page }) => {
  const chat = await clientChat(page);
  await paste(chat, 'Add this for Zeta Industries Pvt Ltd\nName: Ravi Menon\nPAN: DEFPM5678K');
  await expect(chat.getByText(/cannot find Zeta Industries Pvt Ltd among your projects/)).toBeVisible({ timeout: 90_000 });

  expect(cardId).toBeTruthy();
  await page.goto('about:blank');
  await page.context().clearCookies();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(async () => {
    await page.locator('#email:visible').fill(OTHER_CLIENT);
    await page.locator('#password:visible').fill('demo1234');
    expect(await page.locator('#email:visible').inputValue()).toBe(OTHER_CLIENT);
  }).toPass({ timeout: 15_000 });
  await page.locator('button[type="submit"]:visible').first().click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });

  expect((await page.request.get(`/api/ask/changesets/${cardId}`)).status()).toBe(404);
  const decide = await page.request.post(`/api/ask/changesets/${cardId}/decide`, { data: { contentHash: 'x', reject: true } });
  expect([403, 404]).toContain(decide.status());
  const undo = await page.request.post(`/api/ask/changesets/${cardId}/undo`);
  expect([403, 404]).toContain(undo.status());
});

test('a file answers its open request on a card, with no reading, and can be taken back', async ({ page }) => {
  const chat = await clientChat(page);
  await chat.getByTestId('ask-attach-input').setInputFiles({ name: 'rent-agreement.pdf', mimeType: 'application/pdf', buffer: PDF });
  await expect(chat.getByText('rent-agreement.pdf')).toBeVisible({ timeout: 30_000 });
  await chat.getByRole('button', { name: 'Send' }).click();

  const card = chat.locator(`section[aria-label="${REQUEST_TITLE}"]`);
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card).toContainText('rent-agreement.pdf');
  await expect(card.getByTestId('changeset-recipients')).toContainText('Goes to');
  await expect(card.getByTestId('changeset-recipients')).not.toContainText('@');
  expect(await requestStatus()).toBe('pending');

  await card.getByRole('button', { name: 'Accept', exact: true }).click();
  await card.getByRole('button', { name: /^Confirm/ }).click();
  await expect(card.getByRole('button', { name: 'Undo' })).toBeVisible({ timeout: 60_000 });
  expect(await requestStatus()).toBe('fulfilled');

  await card.getByRole('button', { name: 'Undo' }).click();
  await expect(card.getByTestId('changeset-row').first()).toContainText('Undone', { timeout: 60_000 });
  expect(await requestStatus()).toBe('pending');
});

test('the card fits a phone, in the chat window and on the full page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const chat = await clientChat(page);
  await paste(chat, 'Name: Ravi Menon\nPAN: DEFPM5678K');
  const card = chat.locator('section[aria-label^="Details for"]').last();
  await expect(card).toBeVisible({ timeout: 90_000 });
  const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await fits();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await card.getByRole('button', { name: 'Discard' }).click();
  await expect(card).toContainText('Discarded');

  await page.goto('/app/client/ask');
  await page.waitForLoadState('domcontentloaded');
  const composer = page.locator('#ask-composer');
  await expect(composer).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('form:has(#ask-composer) button[aria-label="Attach a file"]')).toBeVisible();
  await fits();
});
