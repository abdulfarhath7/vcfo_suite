// Loads Playwright and the Chromium launch options shared by the checks.
//   PLAYWRIGHT_MODULE  path to the playwright package (default: require('playwright') from src/node_modules,
//                      then /opt/node-tools/node_modules/playwright as found in Claude Code cloud containers)
//   CHROMIUM_PATH      a Chromium binary (default: /opt/pw-browsers/chromium when present, else Playwright's own browser)
const fs = require('fs');
function load() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) { /* try the next one */ } }
  throw new Error('Playwright not found. Run `npm i -D playwright && npx playwright install chromium` in src/, or set PLAYWRIGHT_MODULE.');
}
const { chromium } = load();
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
module.exports = { chromium, launchOpts: exe ? { executablePath: exe } : {} };
