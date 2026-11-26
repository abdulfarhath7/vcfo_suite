# Live browser (card agents, browser route) — gotchas

Spec: `docs/specs/live-portal-browser/PLAN.md`, `CARD-AGENTS.md`, `DECISIONS.md` (B1 to B4).
Service: `services/live-browser/README.md`. Infra: `infra/live-browser.tf`.

## How the pieces talk

- Suite → broker: signed POSTs to `LIVE_BROWSER_URL` (`/sessions`, `/sessions/<id>/status|stop`,
  `/warm`). The signature header is `x-live-browser-signature: t=<unix>,v1=<hmac>` over
  `${t}.${body}`, five minutes of skew (`src/lib/live-browser/contract.ts`).
- Broker → Suite: signed POSTs to `{SUITE_URL}/api/live-browser/callback`. Each op is answered as
  the person who started the session (`systemSessionOwnerContext`), inside that session's
  engagement and run only. A demo login's session is answered in the demo database (`demo: true`
  in the signed body, `runInScope`).
- Viewer → broker: a WebSocket to `LIVE_BROWSER_PUBLIC_URL/sessions/<id>/stream?token=…`. The token
  lives two minutes and only opens the socket; the page asks for a new one on each reconnect.
  `act` goes only to the session's owner or an admin or manager in scope.
- The engine's run is the ordinary `assist_agent_runs` row (`src/lib/assist-agents/run-ops.ts` is
  shared with the extension's routes), so the Assist runs page, the certifier gate (G17) and the
  SRN write-back work unchanged. `live_browser_sessions.run_id` links the two.

## Gotchas

- Turbopack refuses a `node_modules` symlink that points outside the project. In a worktree use a
  hard-linked copy (`rm node_modules && cp -al /home/user/vcfo_suite/node_modules node_modules`).
- The broker's WebSocket checks `Origin` against `SUITE_URL`'s origin. Locally that means
  `SUITE_URL=http://localhost:<port>` must match the address the browser uses for Suite exactly
  (`localhost` and `127.0.0.1` differ).
- `LIVE_BROWSER_MOCK_ORIGIN` (default `http://127.0.0.1:4318`) is where the broker's Chromium finds
  the mock portal. The engine treats only `localhost` and `127.0.0.1` as mock hosts, so the mock
  must be served on one of them; the broker serves it itself with `LIVE_BROWSER_MOCK_PORT`.
- Chromium's own sandbox is off by default, as Playwright's is (it needs user namespaces, which
  Fargate does not give). Isolation is one process and one temporary profile per session, in a
  container that only the ALB reaches. `LIVE_BROWSER_CHROMIUM_SANDBOX=1` turns it on where it works.
- On a machine where Playwright's expected browser build is missing, set
  `LIVE_BROWSER_CHROMIUM_PATH` (the broker) and `UAT_CHROMIUM` (the Playwright e2e config).
- The engine starts when the first viewer opens the stream, not when the session starts: nothing
  is read from Suite into a browser nobody watches. The first gate is LOGIN.
- After login, the mock hides its login strip, so the agent has nothing to refuse there; G1 to G3
  refusals show only when a secret field is visible while the agent scans.
- `live_browser_sessions` rows seeded by the control-room demo (`node = 'demo-agent-runs'`) have no
  broker behind them. The reaper job ends any open session the broker does not hold, so do not run
  the Inngest reaper against a database whose demo rows must stay open.
- One node only: sessions live in the broker's memory, so the ECS service runs one task and a
  deploy ends open sessions. A second node needs a session-to-node map in the ALB.
- `LIVE_BROWSER_TEST_HOOKS=1` (a signed read-only route for the e2e spec) must never be set on AWS.

## Run the e2e spec

```bash
SECRET=$(openssl rand -hex 32)
(cd services/live-browser && node build.mjs && LIVE_BROWSER_SHARED_SECRET=$SECRET SUITE_URL=http://localhost:3103 \
  PORT=8091 LIVE_BROWSER_MOCK_PORT=4318 LIVE_BROWSER_TEST_HOOKS=1 LIVE_BROWSER_EGRESS_IP=203.0.113.10 node dist/server.mjs) &
LIVE_BROWSER_URL=http://127.0.0.1:8091 LIVE_BROWSER_PUBLIC_URL=ws://localhost:8091 LIVE_BROWSER_SHARED_SECRET=$SECRET \
  npx next dev -p 3103 &
LIVE_BROWSER_SHARED_SECRET=$SECRET PLAYWRIGHT_BASE_URL=http://localhost:3103 npx playwright test e2e/live-portal.spec.ts --project=chromium
```

The spec turns the browser route on in `agent_settings` for its run and puts it back afterwards.
