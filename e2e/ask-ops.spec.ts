import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, onLocalDb, openAsk, type DemoRole } from './helpers/login';

/**
 * Two one-step requests from the operations pack, end to end with a live small model: a board meeting
 * and a receipt each become a card, nothing is saved until the person accepts, and the receipt can be
 * undone. It costs a few real tokens, so it runs only with ASK_E2E_LIVE=1 and a model key. Needs a demo
 * database, and no Inngest because a fixed workflow has no run to wake.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.skip(!process.env.ASK_E2E_LIVE, 'Needs ASK_E2E_LIVE=1 and a model key.');

const query = async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
  let out: T[] = [];
  await onLocalDb(async (db) => {
    out = (await db.query(sql, params)).rows as T[];
  });
  return out;
};

async function askOn(page: Page, role: DemoRole, path: string, text: string): Promise<Locator> {
  await login(page, role);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  const panel = await openAsk(page);
  const composer = panel.getByRole('textbox').first();
  const send = panel.getByRole('button', { name: 'Send' }).first();
  await expect(async () => {
    await composer.fill(text);
    await expect(send).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await send.click();
  return panel;
}

async function accept(card: Locator) {
  await card.getByRole('button', { name: 'Accept', exact: true }).click();
  await card.getByRole('button', { name: /Save accepted/ }).click();
  await expect(card.getByText('Saved', { exact: true }).last()).toBeVisible({ timeout: 60_000 });
}

test('a project lead schedules a board meeting from chat, and it waits for the card', async ({ page }) => {
  const date = '2027-03-17';
  const count = async () => (await query<{ n: number }>(`select count(*)::int n from board_meetings m join engagements e on e.id = m.engagement_id where e.slug = 'demo-kestrel-robotics' and m.meeting_date = $1`, [date]))[0]!.n;
  await onLocalDb((db) => db.query(`delete from board_meetings m using engagements e where e.id = m.engagement_id and e.slug = 'demo-kestrel-robotics' and m.meeting_date = $1`, [date]));

  const panel = await askOn(page, 'lead', '/app/intern/engagements/demo-kestrel-robotics', 'Schedule a board meeting on 17 March 2027 at 11:00 by video call.');
  const card = panel.locator('section[aria-label*="meeting" i]');
  await expect(card).toBeVisible({ timeout: 120_000 });
  expect(await count()).toBe(0);
  await accept(card);
  await expect.poll(count, { timeout: 30_000 }).toBe(1);
  await onLocalDb((db) => db.query(`delete from board_meetings m using engagements e where e.id = m.engagement_id and e.slug = 'demo-kestrel-robotics' and m.meeting_date = $1`, [date]));
});

test('an admin records a receipt by invoice number at phone width, and undoes it', async ({ page }) => {
  const [invoice] = await query<{ id: string; invoice_no: string }>(`select id, invoice_no from receivable_invoices where status = 'open' and deleted_at is null and invoice_no is not null order by due_date limit 1`);
  const status = async () => (await query<{ status: string }>('select status from receivable_invoices where id = $1', [invoice!.id]))[0]!.status;

  const panel = await askOn(page, 'admin', '/app/admin/engagements/demo-northwind-analytics', `Mark invoice ${invoice!.invoice_no} as paid in full on 5 November 2026.`);
  const card = panel.locator('section[aria-label*="receipt" i]');
  await expect(card).toBeVisible({ timeout: 120_000 });
  // The rest happens at phone width, as in the agent run spec: the card fits and still works.
  await page.setViewportSize({ width: 375, height: 812 });
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(await status()).toBe('open');

  await accept(card);
  await expect.poll(status, { timeout: 30_000 }).toBe('received');
  await card.getByRole('button', { name: /Undo/ }).click();
  await expect.poll(status, { timeout: 30_000 }).toBe('open');
});
