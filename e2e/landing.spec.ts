import { expect, test, type Page } from '@playwright/test';

/**
 * Landing page v2 checks (R-53, the prototype's docs/LANDING-V2.md, checks T1 to T5).
 * Public page, no sign-in and no demo data needed. Run with `npx playwright test e2e/landing.spec.ts --project=chromium`.
 * T3 reports the page height at 1440 x 900 and at 390 x 844 as test annotations (and on stdout).
 * T6 (Lighthouse) and T7 (LandingScreen.test.tsx) are run outside this file.
 */

const NAV = 68;

/** Every block that holds landing content: none may be transparent or hidden (R5). */
const CONTENT = 'main > section, .reveal, [data-play], .sg, .tk, .dot, .pin, .cluster, .journey .node, .ribbon li, .fact, .cmp-table td > *, .cta .big span';

async function hiddenBlocks(page: Page) {
  return page.evaluate((sel) => {
    const bad: string[] = [];
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (el.closest('[hidden], details:not([open]) > :not(summary)')) return;
      let n: HTMLElement | null = el;
      while (n && !n.classList.contains('lp')) {
        const cs = getComputedStyle(n);
        if (Number(cs.opacity) < 0.5 || cs.visibility === 'hidden') {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').replace(/ /g, '.')} (opacity ${cs.opacity} on ${n.tagName.toLowerCase()})`);
          break;
        }
        n = n.parentElement;
      }
    });
    return bad;
  }, CONTENT);
}

/** The scroll the pinned tracks add beyond their own screen: track height minus the sticky stage. */
async function pinnedScroll(page: Page) {
  return page.evaluate((nav) => {
    let extra = 0;
    document.querySelectorAll<HTMLElement>('[data-pin]').forEach((t) => {
      const stage = t.querySelector<HTMLElement>('.pin-stage');
      if (stage && getComputedStyle(stage).position === 'sticky') extra += Math.max(0, t.offsetHeight - (innerHeight - nav));
    });
    return extra;
  }, NAV);
}

test.describe('landing v2', () => {
  test('T1: the hero headline and both buttons are visible on the first paint, before any script', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForSelector('h1');
    const hero = page.locator('.hero');
    await expect(hero.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(hero.getByRole('button', { name: 'Book a demo', exact: true })).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Try it live' })).toBeVisible();
    await expect(hero.getByText('See how it works')).toHaveCount(0);
    const opacity = await page.evaluate(() =>
      ['.hero-copy .h1', '.hero-ctas', '.hero-shot'].map((s) => {
        let o = 1;
        for (let n = document.querySelector<HTMLElement>(s); n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
        return o;
      }),
    );
    expect(opacity).toEqual([1, 1, 1]);
    await context.close();
  });

  test('T1: with script on, the logo reveal does not cover the hero on load (F3)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#reveal')).toHaveCount(0);
    await expect(page.locator('.lp')).not.toHaveClass(/pre-reveal/);
    await expect(page.locator('.hero h1')).toBeVisible();
  });

  test('T2: a full-page capture without scrolling shows no blank section', async ({ browser }, info) => {
    for (const js of [false, true]) {
      const context = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForTimeout(js ? 1500 : 300);
      expect(await hiddenBlocks(page), `hidden blocks with script ${js ? 'on' : 'off'}`).toEqual([]);
      await info.attach(`full-page-js-${js ? 'on' : 'off'}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      await context.close();
    }
  });

  test('T3: page height at 1440 x 900 is at most 8 screens plus the pinned scroll', async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const pinned = await pinnedScroll(page);
    const sections = await page.locator('main > section').count();
    const note = `1440x900: ${height}px = ${(height / 900).toFixed(2)} screens (${((height - pinned) / 900).toFixed(2)} without the ${pinned}px of pinned scroll), ${sections} sections`;
    info.annotations.push({ type: 'height', description: note });
    console.log(note);
    expect(sections).toBe(9);
    expect(height - pinned).toBeLessThanOrEqual(8 * 900);
  });

  test('T3: page height at 390 x 844 (reported)', async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const note = `390x844: ${height}px = ${(height / 844).toFixed(2)} screens`;
    info.annotations.push({ type: 'height', description: note });
    console.log(note);
    expect(await pinnedScroll(page)).toBe(0);
  });

  test('R4: the two pinned diagrams play with the scroll and rest complete outside it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const story = page.locator('#incorporate');
    const top = await story.evaluate((el) => el.getBoundingClientRect().top + scrollY);
    const span = await story.evaluate((el, nav) => el.offsetHeight - (innerHeight - nav), NAV);
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), top - NAV + span * 0.3);
    await expect(story).toHaveAttribute('data-playing', '');
    const lit = await story.locator('.tk.on').count();
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(16);
    await expect(story.locator('.tk-label')).toHaveText(/^Step \d+ of 16 · /);
    // The stage stays on screen while it plays.
    expect(await story.locator('.stage-panel').evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(NAV - 1);
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), top - NAV + span);
    await expect(story.locator('.tk.on')).toHaveCount(16);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(story).not.toHaveAttribute('data-playing', '');

    const ring = page.locator('#comply');
    const rtop = await ring.evaluate((el) => el.getBoundingClientRect().top + scrollY);
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), rtop - NAV + 120);
    await expect(ring).toHaveAttribute('data-playing', '');
    expect(await ring.locator('.dot.off').count()).toBeGreaterThan(0);
  });

  test('T4: reduced motion runs no animation and shows every diagram complete', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(800);
    for (const y of [0.25, 0.5, 0.75, 1]) {
      await page.evaluate((f) => scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' }), y);
      await page.waitForTimeout(150);
    }
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    expect(running).toBe(0);
    expect(await hiddenBlocks(page)).toEqual([]);
    await expect(page.locator('[data-playing]')).toHaveCount(0);
    await expect(page.locator('.status-chip')).toContainText('Done');
    expect(await pinnedScroll(page)).toBe(0);
  });

  test('T5: a 390 px phone has no sideways scroll and the pinned sections stack', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    const positions = await page.locator('[data-pin] .pin-stage').evaluateAll((els) => els.map((e) => getComputedStyle(e).position));
    expect(positions).toEqual(['relative', 'relative']);
    for (const f of [0.3, 0.6]) {
      await page.evaluate((x) => scrollTo({ top: document.documentElement.scrollHeight * x, behavior: 'instant' }), f);
      await page.waitForTimeout(100);
      await expect(page.locator('[data-playing]')).toHaveCount(0);
    }
  });
});
