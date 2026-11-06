import { expect, test } from '@playwright/test';
import { closeLivePopups, login, onLocalDb } from './helpers/login';

/**
 * The overnight proposals, end to end on a demo database: a real Inngest dev server runs the job once,
 * a lead follows the bell's link to the cards, accepts one file review and leaves the reminders alone,
 * and a super admin reads the result in the token report. No model runs. Reminders are never accepted
 * here, so no mail goes. It needs a server started with ASK_PROACTIVE_ENABLED=true and
 * INNGEST_DEV=<url>, and `npx inngest-cli@latest dev -u <server>/api/inngest -p <port> --no-discovery`
 * with E2E_INNGEST_URL set to the same url. Without that url the spec skips itself.
 */

test.describe.configure({ mode: 'serial', timeout: 240_000 });
test.skip(!process.env.E2E_INNGEST_URL, 'Needs a local Inngest dev server.');

const STARTED = new Date();
const REQUEST_TITLE = 'E2E overnight request';
const FILE_NAME = 'e2e-overnight.pdf';

let href = '';
let firstProject = '';

test.beforeAll(async () => {
  await onLocalDb(async (db) => {
    const { rows: projects } = await db.query(
      `select e.id from engagements e join profiles p on p.intern_id = e.intern_id and p.role = 'intern'
       where p.email = 'lead-divya@demo.vcfo.local' and e.deleted_at is null
         and exists (select 1 from profiles c where c.client_id is not null and c.role = 'client' and c.status = 'active')
       order by e.created_at limit 2`,
    );
    expect(projects.length).toBe(2);
    firstProject = projects[0].id;
    for (const { id } of projects) {
      const { rows } = await db.query(`insert into document_requests (engagement_id, title, status) values ($1, $2, 'pending') returning id`, [id, REQUEST_TITLE]);
      await db.query(`insert into document_request_details (request_id, engagement_id, due_on) values ($1, $2, '2026-09-15')`, [rows[0].id, id]);
    }
    await db.query(`insert into documents (engagement_id, file_name, object_key, step_id, review_status, created_at) values ($1, $2, 'test/e2e-overnight.pdf', 'pre-14', 'pending', '2026-09-01')`, [firstProject, FILE_NAME]);
  });
  const sent = await fetch(`${process.env.E2E_INNGEST_URL}/e/test`, { method: 'POST', body: JSON.stringify({ name: 'dev/run.ask-proactive', data: {} }) });
  expect(sent.ok).toBe(true);
  await expect(async () => {
    await onLocalDb(async (db) => {
      const { rows } = await db.query(
        `select n.description from notifications n join profiles p on p.id = n.user_id
         where p.email = 'lead-divya@demo.vcfo.local' and n.created_at >= $1 and n.description like '%ask.proposal%' order by n.created_at desc limit 1`,
        [STARTED],
      );
      expect(rows.length).toBe(1);
      href = JSON.parse(rows[0].description).href;
    });
  }).toPass({ timeout: 180_000, intervals: [3_000] });
});

test.afterAll(async () => {
  await onLocalDb(async (db) => {
    const { rows } = await db.query(`select id from ask_runs where workflow = 'proactive' and created_at >= $1`, [STARTED]);
    const runs = rows.map((row) => row.id);
    await db.query('delete from ask_changesets where run_id = any($1)', [runs]);
    await db.query('delete from ask_runs where id = any($1)', [runs]);
    await db.query(`delete from notifications where created_at >= $1 and description like '%ask.proposal%'`, [STARTED]);
    await db.query('delete from documents where file_name = $1', [FILE_NAME]);
    await db.query('delete from document_requests where title = $1', [REQUEST_TITLE]);
  });
});

test('the bell link opens every card, and only what the lead accepts happens', async ({ page }) => {
  expect(href).toMatch(/\/ask\?changeset=[^&]+&changeset=/);
  await login(page, 'lead');
  await page.getByRole('button', { name: /notification/i }).first().click();
  const notice = page.getByText(/\d+ proposals? to review/).first();
  await expect(notice).toBeVisible({ timeout: 30_000 });
  // The login helper closes live popups, and this one is the point here.
  await page.removeLocatorHandler(page.locator('#notification-live-title'));
  await notice.click();
  const popup = page.getByRole('dialog').filter({ has: page.locator('#notification-live-title') });
  await expect(popup).toContainText('Nothing is saved or sent until you accept');
  await page.screenshot({ path: 'test-results/ask-proactive-popup.png' });
  await popup.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/\/ask\?changeset=[^&]+&changeset=/, { timeout: 30_000 });
  await closeLivePopups(page);
  const rows = page.getByTestId('changeset-row');
  await expect(rows.filter({ hasText: FILE_NAME })).toHaveCount(1, { timeout: 60_000 });
  await expect(rows.filter({ hasText: REQUEST_TITLE })).toHaveCount(2);
  const review = rows.filter({ hasText: FILE_NAME });
  await expect(review).toContainText('Open this file before you accept');
  await review.getByRole('button', { name: 'Accept', exact: true }).click();
  const card = page.locator('section').filter({ has: review });
  await card.getByRole('button', { name: /^Confirm \(1\)/ }).click();
  await expect(async () => {
    await onLocalDb(async (db) => {
      const { rows: found } = await db.query('select review_status from documents where file_name = $1', [FILE_NAME]);
      expect(found[0].review_status).toBe('approved');
    });
  }).toPass({ timeout: 30_000 });
  await onLocalDb(async (db) => {
    const { rows: sent } = await db.query(`select count(*)::int as n from notification_deliveries where event_type = 'client_reminder' and created_at >= $1`, [STARTED]);
    expect(sent[0].n).toBe(0);
  });
});

for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const) {
  test(`the token report shows the overnight answer per action on a ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, 'super');
    await page.goto('/app/admin/ask-vcfo/usage');
    const table = page.getByRole('region', { name: 'Cards per action' }).or(page.locator('section[aria-labelledby="acceptance-title"]')).first();
    await expect(table).toBeVisible({ timeout: 60_000 });
    const row = table.getByRole('row').filter({ hasText: 'documents.review' }).filter({ hasText: 'Overnight' });
    await expect(row).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/ask-proactive-report-${name}.png` });
  });
}
