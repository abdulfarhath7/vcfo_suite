import 'server-only';

/**
 * A real browser for the portals that refuse programs (2026-10-23).
 *
 * The GST portal (gst.gov.in) answers every non-browser request with an
 * anti-robot challenge page: a script the client must run before the real
 * content is served. Plain `fetch` can never pass it. A real Chrome does,
 * and the page then makes an ordinary data call for its content. So we open
 * the page in headless Chrome through Playwright and return the body of the
 * data call the page itself makes — nothing is scraped from the screen.
 *
 * Where the browser comes from:
 *   - locally: the installed Google Chrome (`channel: 'chrome'`)
 *   - on a server: `ASK_FEEDS_BROWSER=/path/to/chromium` (the alpine image
 *     needs `apk add chromium`; see docs/context/notes/ask-feeds.md)
 * When neither exists the watcher reports it plainly instead of failing
 * silently, and the admin can still drop the document on the Sources page.
 */

export class BrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserUnavailableError';
  }
}

const NO_BROWSER =
  'This portal only answers a real browser, and none is installed on this server. Set ASK_FEEDS_BROWSER to a Chromium executable, or download the update and drop it on the Sources page.';

/**
 * Open `pageUrl` in headless Chrome and return the body of the first
 * successful response whose URL satisfies `matchUrl` (the page's own data
 * call). The browser is closed afterwards whatever happens.
 */
export async function browserCapture(pageUrl: string, matchUrl: (url: string) => boolean, timeoutMs = 60_000): Promise<string> {
  let playwright: typeof import('playwright');
  try {
    playwright = await import('playwright');
  } catch {
    throw new BrowserUnavailableError(NO_BROWSER);
  }
  const executablePath = process.env.ASK_FEEDS_BROWSER?.trim();
  let browser: import('playwright').Browser;
  try {
    browser = executablePath
      ? await playwright.chromium.launch({ headless: true, executablePath })
      : await playwright.chromium.launch({ headless: true, channel: 'chrome' }).catch(() => playwright.chromium.launch({ headless: true }));
  } catch {
    throw new BrowserUnavailableError(NO_BROWSER);
  }
  try {
    const page = await (await browser.newContext()).newPage();
    const captured = page.waitForResponse((res) => res.status() === 200 && matchUrl(res.url()), { timeout: timeoutMs });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const res = await captured;
    return await res.text();
  } finally {
    await browser.close().catch(() => undefined);
  }
}
