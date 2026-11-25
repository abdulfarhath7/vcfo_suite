# Live portal browser on AWS ("VCFO Live Portal") — comparison and plan

## Context

Today government-portal filling runs through the **VCFO Assist Chrome extension**
(`extensions/vcfo-assist`). Each staff member installs it, opens the portal in their own Chrome,
and the side panel fills the form from Suite's data. The owner wants the portal to run instead in a
**live Chromium browser on SBC's AWS**, shown in a browser tab right next to Suite. The person types
only the login, captcha, OTP (and signs/submits); the agent fills everything else. Nothing to install,
works from any computer.

### Where we are today (read from the repo)

- Extension: WXT, MV3, side panel + content script. State machine
  `READY → PULL_PROFILE → WAIT_LOGIN → FILL → CHECK → DOWNLOAD → WAIT_DSC → ATTACH → RECHECK →
  WAIT_SUBMIT_PAY → READ_SRN → WRITE_BACK → DONE` (`src/engine/runner.ts`, `machine.ts`).
- Built recipes: MCA only — SPICe+ Part A, Part B, AGILE-PRO-S, e-MoA, e-AoA (`src/lib/assist-agents/recipes/`),
  all **beta and mock-only**; mock pages exist only for MCA (`mock-portal/spice-*.html`).
- GST: Suite side is built (profile contract `src/lib/registrations/gst-profile.ts`,
  `GET /api/engagements/[id]/assist-profile?form=gst-reg-01`, result write-back of ARN/SRN/GSTIN,
  `GstApplicationCard`, Ask VCFO GST intent). But the GST pack `src/lib/assist-agents/packs/gst.json`
  is a **placeholder**: no capture, no pages, no selectors, `legalStatus: mock-only`, and the
  extension has **no host permission for gst.gov.in**.
- Guards are code (`SAFETY.md` G1–G18): never fill login/captcha/OTP, never Submit/Pay/Sign, signed
  recipes, kill switch, labels-only AI, live-portal switch (G11) waiting on the CS opinion.
- Firm policy **SBC-STD-AI-02** ("Agents prepare. Humans file.") puts statutory portals on the
  browser block-list. **G12** ("attended only, the user's own visible tab, no headless browser") and
  **G8** ("store no portal cookies or session tokens, in the extension or in Suite") were written for
  the extension. A cloud browser changes both, so the CS opinion and the policy must cover it.
- Good news for reuse: the engine is already port-based. `src/engine/ports.ts` defines
  `PortalPort` (scan, fill, click, attach, readSrn, highlightHuman…), `SuitePort` and `StorePort`;
  only `src/portal/chrome-portal.ts` and `src/suite/suite-client.ts` are Chrome-specific.

## Difference table: today vs. what you are asking for

| Area | Today: VCFO Assist extension | Proposed: Live Portal browser on AWS |
|---|---|---|
| Where the portal runs | The staff member's own Chrome on their PC | A fresh Chromium container on SBC's AWS (Mumbai, ap-south-1), one per run |
| What the user installs | Extension, force-installed by Chrome enterprise policy | Nothing. Any browser, any OS, even a tablet |
| How the user sees the portal | Their own portal tab + side panel | A Suite tab ("Live portal") streaming the remote browser, opened next to the Suite tab, with the agent rail beside the stream |
| Login, captcha, OTP | User types in their own tab | User types into the live stream (keyboard/mouse go to the remote browser). Agent still never reads or fills them |
| Form filling | Content script in the user's tab | Same engine, driven by Playwright inside the container (CDP on localhost only) |
| Engine, guards, recipes | `extensions/vcfo-assist/src/*` | The same code, moved to a shared package so both use it; guards unchanged |
| Data path from Suite | Fetched inside the open Suite tab with the user's cookie | Server to server: container calls Suite API with a short-lived, run-scoped token |
| Documents to upload (PAN, address proof, photos) | User's machine / dropped in panel | Pulled from Suite's S3 vault straight into the portal's upload box (SHA-256 checked) |
| DSC signing | emSigner/emBridge on the user's PC with their USB token | **Cannot reach a USB token in the cloud.** EVC (OTP) works in the stream; DSC submit happens on the user's PC (see "DSC" below) |
| Session cookies | Live in the user's browser only | Live in SBC's container memory for the run; container destroyed at the end, nothing persisted |
| Portal IP seen by GSTN/MCA | The user's office/home IP | SBC's fixed Indian Elastic IP (one NAT IP), logged per run |
| Parallel sessions / lockout risk | One run per tab | One container per run, one run per portal login enforced by Suite |
| Updates | Signed extension release, enterprise policy push | Container image deploy; no user action |
| Audit (G14) | Install id, user agent, IP Suite saw | Run id, container id, who opened the stream and when, egress IP, every fill/refusal |
| Portals covered | MCA V3 (5 forms, mock-only) | Same recipes on day one; GST REG-01 once captured and mocked |
| Legal status | Mock-only until CS opinion; GST blocked by SBC-STD-AI-02 | Same gate, plus a new CS question: is a firm-hosted, attended cloud browser acceptable (G8/G12 rewritten) |
| Running cost | ~₹0 | Fargate ~US$0.10/hour per active run + ALB and NAT ~US$55/month |
| Weak spots | Needs Chrome + extension on every PC | Stream latency, DSC needs the local PC, portal may flag datacentre IPs |

## Recommended approach

**Self-hosted on our own AWS (ap-south-1).** Chromium + Xvfb + noVNC in an ECS Fargate task per run,
the VCFO Assist engine driving the same Chromium through Playwright, and Suite brokering sessions.
Keep the extension as a fallback (DSC on the user's PC, portals that block cloud IPs). Build and test
against the mock portals now; each live portal turns on only through the existing live switch once
the CS opinion covers it. Rejected: third-party browser clouds (Browserbase, Steel) — the government
session and client KYC would sit on US infrastructure, the same objection the legal review raised
for hosted agent browsers. AWS AgentCore Browser is a fallback option if its Mumbai availability and
data terms check out.

### How one run works

1. Lead clicks **"Open live portal"** on the GST record / checklist step (`GstApplicationCard`,
   `StartOnGstPortal`, the Assist runs page). Suite creates an `assist_runs` row and a
   `live_browser_sessions` row (repository with `AuthContext`, staff only, engagement scoped) and
   queues the Inngest job `live-browser-start`.
2. The job calls ECS `RunTask` (task def `vcfo-live-browser`), waits until the task is healthy,
   stores its private IP, and marks the session `ready`.
3. Suite opens `/app/{lead|manager|admin}/live-portal/[sessionId]` in a new tab. The page shows the
   noVNC canvas (WebSocket via `live.sbctrack.in` ALB → container, gated by a Suite-signed JWT for that
   session and user) and the agent rail (run steps, "You do this" cards, fill-preview table G13,
   Fill page, document drop, certifier gate G17).
4. Container opens the portal start URL. Engine sits in `WAIT_LOGIN`; the user logs in, types the
   captcha and OTP in the stream.
5. Engine runs `FILL`: shows the preview table in the rail, user clicks **Fill page**, Playwright fills
   (same scanner/filler/heal ladder), uploads vault documents, marks human fields.
6. Human gates (DSC/EVC, Submit, Pay) are highlighted in the stream; the user does them.
7. Engine reads ARN/SRN/TRN, writes back through the existing result route
   (`POST /api/assist/engagements/[id]/result`), and the container is stopped. Idle timeout
   15 minutes, hard cap 90 minutes, no browser profile kept.

### DSC (the one thing a cloud browser cannot do)

- **EVC** (OTP to the authorised signatory): done in the stream, the person types the OTP.
- **DSC on GST**: the agent fills and **saves** the application (portal gives a TRN). The signatory
  opens the saved application on their own PC with the TRN and submits with DSC (extension can help
  there). Suite shows this as one "You do this" card with the TRN.
- **DSC on MCA**: the portal's PDF is downloaded from the container into Suite; the signer signs it
  locally and drops it back in the rail; the container attaches it byte-for-byte (existing G6 rule).

## Build phases

| # | Phase | Exit criterion |
|---|---|---|
| 0 | Decisions: add the cloud-browser question to `docs/specs/vcfo-assist-agents/CS-QUESTIONS.md`; owner amends SBC-STD-AI-02; proposed guards G19–G23 drafted in `SAFETY.md` section 7 (not in force; G8/G12 unchanged until the CS answers question 32) | Done 25 Nov 2026 in docs (question 32, SAFETY section 7); still to do: send the CS letter, owner amends SBC-STD-AI-02 |
| 1 | Extract `engine/ guards/ heal/ recipes/ portal/{scanner,filler,label,srn}` from `extensions/vcfo-assist/src` into `packages/assist-engine` (own package.json); extension imports it | Extension `npm test` and `npm run e2e` pass unchanged |
| 2 | `services/live-browser/` container: Dockerfile (Chromium, Xvfb, x11vnc, websockify/noVNC, Node), `runner.ts` that builds the engine with `PlaywrightPortalPort` (page.evaluate of the bundled scanner/filler, replaces `chrome-portal.ts`), `ServerSuitePort` (replaces in-tab fetch in `suite-client.ts`), `RunStorePort` (persists to Suite `assist_runs`), JWT-checking WebSocket proxy, control API (localhost CDP never exposed) | `docker compose` run fills mock `spice-a.html` end to end with a person typing the login strip in noVNC |
| 3 | Suite: migration `00xx_live_browser_sessions` (additive), repository `src/db/repositories/live-browser-sessions.ts`, routes `app/api/live-browser/sessions` (create, get, stop, token), Inngest jobs `live-browser-start` / `live-browser-reaper` in `src/jobs/`, page `src/views/live-portal/LivePortalView.tsx` + thin shells under `app/app/{lead,manager,admin}/live-portal/[id]`, rail components ported from `extensions/vcfo-assist/entrypoints/sidepanel` and `src/ui`, "Open live portal" button on `GstApplicationCard` and the Assist runs page | `npm run check`; role tests (client 403, lead only own engagements) |
| 4 | Infra: `infra/live-browser.tf` — ECR repo, ECS cluster + Fargate task def (2 vCPU, 4 GB), private subnets with NAT + Elastic IP, ALB `live.sbctrack.in` with WebSocket listener, security groups (ALB → task only), IAM so App Runner can `ecs:RunTask/StopTask`, env `LIVE_BROWSER_*` and a secret for the stream JWT key | Terraform plan reviewed; session starts in under 60 s on AWS against the mock |
| 5 | GST REG-01: recorder capture (only once the CS allows it), GST mock pages, `gst-reg-01` recipe, fill `pages/selectors` in `packs/gst.json`, TRN save + DSC hand-off card | Mock GST run reaches TRN with 0 AI calls |
| 6 | Live pilot: the live switch (`ASSIST_LIVE_PACKS`) lists the pack; supervised filings with reviewer sign-off | Agreed number of filings, zero guard violations, zero lockouts |

Phases 1–4 need no CS reply (mock only). Phases 5–6 are blocked until it arrives.

## Reuse (do not rewrite)

- Engine, state machine, guards, heal ladder, recipe signature checks: `extensions/vcfo-assist/src/{engine,guards,heal,recipes}`.
- Suite catalog, recipes, packs, kill switch, attestation, SRN write-back: `src/lib/assist-agents/*`, `app/api/assist/*`.
- GST profile and readiness: `src/lib/registrations/gst-profile*.ts`, `gst-readiness.ts`, `src/db/repositories/gst-profile.ts`.
- S3 helpers for vault documents: `src/storage/`. Inngest client: `src/jobs/client.ts`. Role helpers: `src/lib/auth.ts`.

## Verification

- `npm run check` in Suite; `npm test` and `npm run e2e` in the extension after the engine move.
- New Playwright spec `e2e/live-portal.spec.ts`: sign in as a lead, open live portal, see the noVNC
  canvas, type the mock login strip through the canvas, Fill page, assert fields on the mock, assert
  Submit is never clicked by the agent and the certifier gate holds.
- Guard tests in the service: the agent never types into captcha/OTP/password inputs over CDP; a
  client user and another lead get 403 on the stream token; a stopped session's WebSocket is refused.
- Teardown test: after DONE/cancel/idle the ECS task is gone and nothing (cookies, profile) is in S3 or the DB.
- Load check: 3 concurrent sessions on AWS, stream latency measured from Hyderabad.

## Decisions for the owner (defaults assumed above)

1. Live use waits for the CS opinion and an amended SBC-STD-AI-02 (default) — or pilot sooner.
2. Hosting: own AWS Mumbai (default) vs AWS AgentCore Browser.
3. Keep the extension as the DSC/IP fallback (default) vs retire it.
