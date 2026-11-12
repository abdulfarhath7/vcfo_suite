import ExcelJS from 'exceljs';
import { expect, test, type Page } from '@playwright/test';
import { login, onLocalDb } from './helpers/login';

/**
 * The admin imports next financial year's statutory calendar from the Excel template: download the
 * template filled with this year, move every date a year on, check it, publish it, and see the new
 * year on the calendar. A file with mistakes lists them by Excel row and saves nothing. No other
 * role sees the import buttons or may call the import route.
 *
 * It writes FY 2027-28, so it runs on a local database only and clears that year first.
 */

const NEXT_FY = '2027-28';

/** The statutory calendar is the "By act" view of the Compliances calendar page. */
async function calendarPage(page: Page) {
  await page.goto('/app/admin/compliances/calendar');
  await page.getByRole('tab', { name: 'By act' }).click({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Statutory calendar' })).toBeVisible({ timeout: 30_000 });
}

/** The admin's Import calendar sits in the Calendar file menu of the toolbar. */
async function openImport(page: Page) {
  await page.getByRole('button', { name: /Calendar file/ }).click();
  await page.getByRole('menuitem', { name: /Import calendar/ }).click();
}

/** This year's calendar as the filled template, with every date moved one year on. */
async function nextYearWorkbook(page: Page): Promise<Buffer> {
  const res = await page.request.get('/api/statutory-calendar/template?fy=2026-27');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('spreadsheetml');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  const sheet = workbook.getWorksheet('Calendar')!;
  sheet.eachRow((row, n) => {
    const value = row.getCell(1).value;
    if (n > 1 && value instanceof Date) {
      const moved = new Date(value);
      moved.setUTCFullYear(moved.getUTCFullYear() + 1);
      row.getCell(1).value = moved;
    }
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test.describe('statutory calendar import', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(!process.env.DATABASE_URL, 'writes a financial year, so it needs the local database');

  test.beforeAll(async () => {
    await onLocalDb((db) => db.query('delete from statutory_calendars where fy = $1', [NEXT_FY]));
  });

  test('a file with mistakes lists them by row and saves nothing', async ({ page }) => {
    await login(page, 'admin');
    await calendarPage(page);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Calendar');
    sheet.addRow(['Due Date', 'Act', 'Compliance', 'Applies To', 'Note']);
    sheet.addRow([new Date(Date.UTC(2027, 3, 11)), 'GST', 'GSTR-1']);
    sheet.addRow([new Date(Date.UTC(2026, 3, 11)), 'SEBI', '']);
    const bad = Buffer.from(await workbook.xlsx.writeBuffer());

    await openImport(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Financial year').selectOption(NEXT_FY);
    await dialog.getByLabel('Excel file (.xlsx)').setInputFiles({ name: 'bad.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bad });
    await dialog.getByRole('button', { name: 'Check file' }).click();
    await expect(dialog.getByText('3 problems to fix in bad.xlsx. Nothing was saved.')).toBeVisible();
    await expect(dialog.getByRole('cell', { name: '"SEBI" is not in the Act list.' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Publish/ })).toHaveCount(0);
  });

  test('the admin publishes next year and the calendar shows it', async ({ page }) => {
    await login(page, 'admin');
    await calendarPage(page);
    await page.getByRole('button', { name: /Calendar file/ }).click();
    await expect(page.getByRole('menuitem', { name: /Download template/ })).toBeVisible();
    await page.keyboard.press('Escape');
    const file = await nextYearWorkbook(page);

    await openImport(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Financial year').selectOption(NEXT_FY);
    await dialog.getByLabel('Excel file (.xlsx)').setInputFiles({ name: 'SBC Statutory Calendar FY 2027-28.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: file });
    await dialog.getByRole('button', { name: 'Check file' }).click();
    await expect(dialog.getByText(/deadlines for FY 2027-28 in SBC Statutory Calendar FY 2027-28\.xlsx\. The file is ready to publish\./)).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish FY 2027-28' }).click();
    await expect(dialog).toBeHidden();

    // The page opens the imported year on April, in the Month view, with its deadlines on the grid.
    await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Choose month' })).toContainText('April');
    await expect(page.getByRole('button', { name: /^7 April, \d+ (filings?|items?)/ }).first()).toBeVisible();
    const api = await page.request.get(`/api/statutory-calendar?fy=${NEXT_FY}`);
    const body = (await api.json()) as { calendar: { source: string; deadlines: { date: string }[] } };
    expect(body.calendar.source).toBe('imported');
    expect(body.calendar.deadlines.length).toBeGreaterThan(200);
    expect(body.calendar.deadlines.every((d) => d.date >= '2027-04-01' && d.date <= '2028-03-31')).toBe(true);
  });

  test('a lead sees every deadline of the file on Month, whatever companies they hold, and can narrow it', async ({ page }) => {
    await login(page, 'lead');
    await page.goto('/app/lead/compliances/calendar');
    await expect(page.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true', { timeout: 60_000 });
    const api = await page.request.get('/api/statutory-calendar');
    const { calendar } = (await api.json()) as { calendar: { deadlines: { date: string; act: string }[] } };
    const month = new Date().toISOString().slice(0, 7);
    const inMonth = calendar.deadlines.filter((d) => d.date.startsWith(month));
    // This lead holds no company, so every deadline on the Month view comes from the file.
    await expect(page.getByRole('tablist', { name: 'Filter by area' }).getByRole('tab', { name: new RegExp(`^All\\s*${inMonth.length}$`) })).toBeVisible();
    const gst = inMonth.filter((d) => d.act === 'GST').length;
    await page.getByRole('tablist', { name: 'Filter by area' }).getByRole('tab', { name: /^GST/ }).click();
    await expect(page.getByRole('tablist', { name: 'Filter by area' }).getByRole('tab', { name: new RegExp(`^GST\\s*${gst}$`) })).toHaveAttribute('aria-selected', 'true');

    // By act is the same calendar as a list, with its own act tabs.
    await page.getByRole('tab', { name: 'By act' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`· ${inMonth.length} deadlines?$`) })).toBeVisible();
    // A lead has no import buttons.
    await expect(page.getByRole('button', { name: /Calendar file/ })).toHaveCount(0);
  });

  test('a super admin reads the calendar but cannot import', async ({ page }) => {
    await login(page, 'super');
    await calendarPage(page);
    await expect(page.getByRole('button', { name: /Calendar file/ })).toHaveCount(0);
    const read = await page.request.get(`/api/statutory-calendar?fy=${NEXT_FY}`);
    expect(read.status()).toBe(200);
    expect(((await read.json()) as { canImport: boolean }).canImport).toBe(false);
    expect((await page.request.get('/api/statutory-calendar/template')).status()).toBe(403);
    const post = await page.request.post('/api/statutory-calendar/import', { multipart: { fy: NEXT_FY, publish: '1' } });
    expect(post.status()).toBe(403);
  });
});
