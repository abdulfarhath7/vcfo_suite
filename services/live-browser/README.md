# VCFO Live Browser (the broker)

The live portal browser on SBC's own AWS (docs/specs/live-portal-browser/PLAN.md, DECISIONS.md
B1 to B4). One small Node service keeps a pool of Chromium processes, one per live session, each
with a fresh temporary profile that is deleted when the session ends. The portal page streams to
VCFO Suite as JPEG frames from the Chrome DevTools screencast over a WebSocket. The VCFO Assist
engine fills the form inside the same page, with the same code the Chrome extension runs.

This folder is its own package (own `package.json`, `tsconfig.json`, tests and `Dockerfile`). The
Suite's root scripts, `tsc` and `eslint` skip it, as they skip `extensions/`.

## What it reuses

- The engine, the state machine, the guards, the heal ladder and the recipe checks are imported
  from `extensions/vcfo-assist/src`; nothing is moved or copied (B2).
- The in-page agent (`src/inpage/entry.ts`) is the extension's `PortalAgent` (scanner, filler,
  guards, overlay) bundled into one script and added to every portal document. The only addition
  is `typeInto`, which types a text value at a readable speed after the guards allow the control.
- `src/playwright-portal.ts` is the engine's `PortalPort` over Playwright (the extension has
  `chrome-portal.ts`).
- `src/server-suite.ts` is the extension's own `SuiteClient` with a different transport: the
  catalog, the signed recipe and the profile come with the session start; run calls become
  HMAC-signed callbacks to `POST {SUITE_URL}/api/live-browser/callback`.
- The signing contract is `src/lib/live-browser/contract.ts` in Suite, imported here, so both
  sides sign the same bytes.

## Run it locally

```bash
cd services/live-browser
node build.mjs                      # dist/inpage.js and dist/server.mjs
LIVE_BROWSER_SHARED_SECRET=$(openssl rand -hex 32) \
SUITE_URL=http://localhost:3000 PORT=8091 \
LIVE_BROWSER_MOCK_PORT=4318 \
node dist/server.mjs
```

`LIVE_BROWSER_MOCK_PORT` also serves the extension's mock portal on `127.0.0.1:4318`, so a local
run needs no second process. Suite needs `LIVE_BROWSER_URL=http://127.0.0.1:8091`,
`LIVE_BROWSER_PUBLIC_URL=ws://localhost:8091` and the same `LIVE_BROWSER_SHARED_SECRET`; the admin
switch Settings > Agents > browser must be on. On a machine whose Chromium is not where Playwright
expects it, set `LIVE_BROWSER_CHROMIUM_PATH`. The full list of settings is at the top of
`src/config.ts`.

## Tests

```bash
npm test          # vitest: units (signatures, input, G13 approval, status) and a full Part A run
npm run typecheck # strict tsc over the service and the engine files it imports
```

The session test starts the mock portal, a fake Suite that checks every callback's signature, the
broker and a real Chromium. It proves a watch viewer's keys are dropped, the person logs in
through an act viewer, the agent fills Part A without a further click, Submit waits for the
certifier's checks, the agent never clicks Submit, Pay or Send OTP, and the SRN goes back to Suite.

## Image

```bash
docker build -f services/live-browser/Dockerfile -t vcfo-suite-live-browser .   # from the repository root
```

Behind a TLS-inspecting proxy add `--network host --secret id=ca,src=<ca bundle>`. The image is
the Playwright image for 1.62.1; it runs as `pwuser`. Terraform for ECS, the ALB and the fixed
egress IP is `infra/live-browser.tf`.

## Rules the broker keeps

- Frames go to open sockets only; none is written, kept or sent to Suite (proposed G22).
- Input from an `act` token goes to the page through CDP `Input.dispatch*` and `Input.insertText`;
  input from a `watch` token is dropped. No input is ever logged or stored.
- The fill pauses while nobody watches (proposed G20) and on Pause.
- Downloads are cancelled, except a PDF while the engine is at DOWNLOAD or WAIT_DSC, held in memory
  for the act viewer to fetch once.
- Idle and hard-stop limits come from Suite's settings with the session start; Suite's reaper job
  checks again. At the end the browser closes and its profile folder is deleted (proposed G19).
- `LIVE_BROWSER_TEST_HOOKS=1` adds a signed read-only route the e2e test uses to read the mock
  page; it must never be set on AWS.
