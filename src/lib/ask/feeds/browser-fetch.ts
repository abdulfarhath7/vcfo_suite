import 'server-only';

/**
 * A real browser for the portals that refuse programs (2026-10-23/24).
 *
 * The GST portal (gst.gov.in) answers every non-browser request with an
 * anti-robot challenge page: a script the client must run before the real
 * content is served. The e-Gazette (egazette.gov.in) keeps its session in
 * the URL and only answers a search made step by step from its own pages.
 * Plain `fetch` can do neither. A real Chrome can, so we open the page in
 * headless Chrome through Playwright and either return the body of the data
 * call the page itself makes (`browserCapture`) or run a short click-through
 * on the page (`withBrowserPage`).
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

type Playwright = typeof import('playwright');
export type BrowserPage = import('playwright').Page;

async function launch(): Promise<import('playwright').Browser> {
  let playwright: Playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new BrowserUnavailableError(NO_BROWSER);
  }
  const executablePath = process.env.ASK_FEEDS_BROWSER?.trim();
  try {
    return executablePath
      ? await playwright.chromium.launch({ headless: true, executablePath })
      : await playwright.chromium.launch({ headless: true, channel: 'chrome' }).catch(() => playwright.chromium.launch({ headless: true }));
  } catch {
    throw new BrowserUnavailableError(NO_BROWSER);
  }
}

/** Run `fn` with a fresh page in a fresh browser; the browser is closed afterwards whatever happens. */
export async function withBrowserPage<T>(fn: (page: BrowserPage) => Promise<T>): Promise<T> {
  const browser = await launch();
  try {
    const page = await (await browser.newContext()).newPage();
    return await fn(page);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/**
 * Open `pageUrl` and return the body of the first successful response whose
 * URL satisfies `matchUrl` (the page's own data call).
 */
export async function browserCapture(pageUrl: string, matchUrl: (url: string) => boolean, timeoutMs = 60_000): Promise<string> {
  return withBrowserPage(async (page) => {
    const captured = page.waitForResponse((res) => res.status() === 200 && matchUrl(res.url()), { timeout: timeoutMs });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const res = await captured;
    return res.text();
  });
}
