import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const html = path.resolve('docs/whats-built-today.html');
const pdf = path.resolve('docs/whats-built-today.pdf');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: pdf,
  printBackground: true,
  preferCSSPageSize: true,
  landscape: true,
});
await browser.close();
console.log(`Wrote ${pdf}`);
