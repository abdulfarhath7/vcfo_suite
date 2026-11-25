# Card agents: one robot on each registration, compliance and MCA card

## Context

The owner wants a task robot on each card (for example "GST Reg Agent" on GST registration),
beside the Ask VCFO robot. When you click it, it is ready for that task. It works by buttons. It
takes the data from VCFO Suite and puts it into the government portal, which runs in the live
browser on SBC's AWS (`docs/specs/live-portal-browser/PLAN.md`). The person types the login,
captcha and OTP, signs, and presses Submit.

## Verdict on the owner's idea

The idea is good. It is better than my last plan. My last plan showed an engineer's view (an
organisation chart of 11 agents). The owner's plan shows the user's view: the robot is on the page
where the work is. Keep it. Correct five points:

| # | Risk in the idea | Correction |
|---|---|---|
| 1 | "50 agents" suggests 50 programs to build and maintain | Build ONE card-agent component and ONE engine. Each card gets its own name, colour and recipe from the catalog. A new agent = a new recipe file, not new code. |
| 2 | Two robots open two popups that compete in the corner | One corner dock. On a card page the dock shows two robots: Ask VCFO (talk) and the card agent (buttons). Only one panel opens at a time. |
| 3 | "It knows exactly what to do" is true only when its recipe exists. Today 5 MCA recipes exist; GST has 0 recorded pages. | The robot shows its real level: "Ready", "Prepares data only" or "Coming". A robot that cannot fill yet still checks data and collects documents. |
| 4 | Starting with GST is the hardest start: GST terms forbid unofficial tools, DSC cannot work in a cloud browser, and no pages are recorded | Start with MCA SPICe+ Part A. Its recipe exists and passes on the mock. Prove the full loop once. Then add GST. |
| 5 | Bouncing between two tabs (type captcha in one tab, click Fill in the other) is slow | Start on the card in Suite. Then work in the live portal tab: portal on the left, the same agent buttons on the right. The card shows the status. |

Also do not let the agent type the saved portal passwords. `RegistrationBoxes.tsx` already shows
portal usernames and passwords from the encrypted credentials workbook. The legal review rates a
tool that fills stored client passwords as Prohibited (TaxPido row), and guard G1 forbids it.

## What the user sees

```
 VCFO Suite tab: Kestrel Robotics > GST registration
 +----------------------------------------------------------------+
 | GST Registration                         Status: Data 92% ready |
 | [ tracker card ... ]                                            |
 |                                                                 |
 |                                   +--------------------------+  |
 |                                   | GST Reg Agent    [x]     |  |
 |                                   |  Ready. 3 values missing |  |
 |                                   |  [1 Check data]          |  |
 |                                   |  [2 Open live portal]    |  |
 |                                   +--------------------------+  |
 |                             (robot) GST Reg Agent  (robot) Ask  |
 +----------------------------------------------------------------+

 Live portal tab (opens next to the Suite tab)
 +--------------------------------------------+-------------------+
 |  GST PORTAL (live, from SBC server)        | GST Reg Agent     |
 |                                            | Step 2 of 9       |
 |  User ID  [ you type ]                     | You do this:      |
 |  Password [ you type ]                     |  log in, captcha, |
 |  Captcha  [ you type ]                     |  OTP              |
 |                                            | [3 Fill this page]|
 |                                            | Preview: 14 fields|
 |                                            | [4 Next page]     |
 |                                            | You do this:      |
 |                                            |  sign and Submit  |
 +--------------------------------------------+-------------------+
```

## The buttons (same for every card agent)

```
 [1 Check data] -> [2 Open live portal] -> you log in -> [3 Fill this page]
       |                                                  (repeat per page)
       v                                                        |
  missing values                                                v
  -> "Fix in Suite"                         you sign, you Submit, you pay
                                                                |
                                                                v
                                        [4 Save ARN/SRN] -> card shows "Filed"
```

| Button | What the agent does | Works today without the live browser |
|---|---|---|
| 1 Check data | Reads the card's data. Lists missing and dummy values. Links each to its field. | Yes (`gst-readiness.ts`, `/api/assist/step-link`) |
| 2 Open live portal | Starts one live browser. Opens the portal tab. | No (needs PLAN.md phases 1 to 4) |
| 3 Fill this page | Shows the preview table. Fills the page when you confirm. | Mock only |
| 4 Save ARN/SRN | Reads the number from the portal. Writes it to the card. | Yes, typed by hand (`/api/assist/engagements/[id]/result`) |

## How it is built

```
 card page (reg-4, ACT-M08, pre-4 ...)
        | useCardAgent({ engagementId, stepId | activityId })
        v
 catalog.ts  --->  task: gst-reg-01, name "GST Reg Agent", colour, recipe, gates, level
        v
 CardAgentLauncher (corner dock, beside AskAvatarLauncher) --> CardAgentPanel (buttons)
        v
 live session API ---> live browser (one per filing) ---> shared engine + recipe
        v
 result route ---> card status, ARN/SRN, reminders
```

| Part | New or reuse | Where |
|---|---|---|
| Robot avatar with colour and moods | Reuse | Move `extensions/vcfo-assist/src/ui/Robot.tsx` to `src/components/card-agent/Robot.tsx` |
| Task list, names, gates, card mapping | Reuse and extend | `src/lib/assist-agents/catalog.ts` (tasks already carry `stepId` / `activityId`); add `agentName`, `colour`, `level` |
| Corner dock | Extend | `src/components/ask/AskShellMount.tsx` mounts `CardAgentLauncher` next to `AskAvatarLauncher`; reuse `use-avatar-yield.ts` |
| Page tells the dock which card is open | New hook | `src/hooks/use-card-agent.ts`, called from `RegistrationView.tsx`, the compliance record view and the checklist step view |
| Button panel | New | `src/components/card-agent/CardAgentPanel.tsx`; steps from `extensions/vcfo-assist/src/ui/steps.ts` |
| Check data | Reuse | `src/lib/registrations/gst-readiness.ts`, `/api/engagements/[id]/assist-profile`, `step-link.ts` |
| Live browser and engine | New (already planned) | `docs/specs/live-portal-browser/PLAN.md` phases 1 to 4 |
| Live portal tab with the right-hand rail | New (already planned) | `src/views/live-portal/LivePortalView.tsx`, same `CardAgentPanel` |
| Save ARN/SRN | Reuse | `src/lib/assist-agents/record-srn.ts`, `gst-assist.ts` |

## Build order

| Step | Deliverable | Legal now | Size |
|---|---|---|---|
| 1 | Robot dock and panel on every card with a catalog task. Button 1 (Check data) and button 4 (type ARN/SRN by hand). Level badge "Ready / Prepares data only / Coming". | Yes | 1 to 2 weeks |
| 2 | Live browser platform (PLAN.md phases 1 to 4) on the MCA mock | Yes | 3 to 4 weeks |
| 3 | First full agent: "Name Reservation Agent" (SPICe+ Part A) end to end on the mock in the live browser | Yes | 1 week |
| 4 | The other 4 MCA recipes in the live browser (Part B, AGILE-PRO-S, e-MoA, e-AoA) | Yes | 1 to 2 weeks |
| 5 | Send the CS letter (questions 30 and 32). Owner amends SBC-STD-AI-02. | Owner | Waiting time |
| 6 | Live pilot on MCA after the CS reply | After CS | 2 weeks |
| 7 | GST Reg Agent: record the GST pages, build a mock and a recipe, TRN + DSC hand-off | After CS | 2 to 3 weeks |
| 8 | Add more agents: one recipe each, wave order in `AGENTS.md` | After CS, per portal | About 3 to 5 days each |

Step 1 is useful on day one. Each card gets its robot, the data check and the document list
before any portal work.

## What NOT to do

| Do not | Why |
|---|---|
| Build a separate agent program per card | 50 copies to fix when one thing changes |
| Let the agent type saved portal passwords, the captcha or the OTP | Prohibited in the legal review; guards G1 to G3 |
| Start with GST | Weakest legal position, no recorded pages, DSC cannot run in the cloud |
| Show "Ready" on a card that has no recipe | Users lose trust when the robot cannot do the job |
| Build all 50 at once | Prove one full loop first |

## Verification

- Step 1: open GST registration, AOC-4 and SPICe+ Part A cards as a lead. Each shows its own
  robot beside Ask VCFO. Check data lists the same missing count as the step. A client sees no
  card agent. `npm run check` passes; a component test covers the dock with two robots.
- Step 3: Playwright `e2e/card-agent.spec.ts`: lead opens the SPICe+ Part A card, clicks the
  robot, Check data, Open live portal, types the mock login in the stream, Fill this page,
  asserts the fields on the mock, asserts the agent never clicks Submit, saves the SRN, and the
  card shows "Filed".

## Where the user sees it (lead paths; managers and admins use `/app/manager/...` and `/app/admin/...`)

| # | Page | Address | What appears |
|---|---|---|---|
| 1 | Registration record (for example GST) | `/app/lead/registrations/<client>~reg-4` (Registrations, GST box, client) | Card robot beside Ask VCFO, bottom right |
| 2 | Checklist step (for example Name reservation) | `/app/lead/engagements/<client>/step/pre-4` | Card robot; the "VCFO Assist can fill ..." hint card becomes "Open live portal" |
| 3 | One client's filing (for example AOC-4) | `/app/lead/compliances/obligations/mca-aoc-4/<filing>` | Card robot |
| 4 | Assist runs list | `/app/lead/assist-runs` (exists) | Every open and finished live session; "Open again" |
| 5 | Live portal tab (new) | `/app/lead/live-portal/<session>` | Portal on the left, the agent's buttons on the right |

Clients never see the card robot or the live portal. Use a laptop or a desktop; a tablet works; a phone is too small to type the captcha.

## Owner change (25 Nov 2026): the live portal shows inside the app

The live portal opens inside the same Suite page, not only in a new tab.

- The government site is never put in an iframe (its headers forbid it). The app shows a video
  stream of SBC's server browser, so it can sit in any Suite page.
- Live mode on the record page (pages 1 to 3): the sidebar folds, the portal stream takes about
  70% of the width, and the agent rail takes the rest. The rail keeps the card's key values.
- A small live preview stays on the card when live mode is closed. Click it to open live mode again.
- A "Pop out" button opens the same session in its own tab (for a second screen). One session
  is shared, so the two views never conflict.
- Page 5 (`/app/lead/live-portal/<session>`) stays as the pop-out page and for Assist runs.

## Owner change (25 Nov 2026): watch in the app, act in the portal tab

- In the app (live mode on the card page) the user watches the agent fill. The view is
  watch-only while the agent works, so a stray click cannot disturb the fill. A "Pause" button stops it.
- The fill is visible: the agent types each field at a readable speed, the extension's overlay
  (`extensions/vcfo-assist/src/portal/overlay.ts`) draws a box round the field being written, and
  the rail ticks the fields off with a progress bar. Reuse the look of Ask VCFO "Watch it fill"
  (`src/components/ask/fill/GhostCursor.tsx`, `FillRail.tsx`).
- At a human step (login, captcha, OTP, DSC or EVC, Submit, Pay) the agent stops. The app shows
  "Your turn: go to the Live portal tab and type the captcha" with a "Go to portal tab" button.
  The portal tab is the only view that takes keys and clicks.
- Browsers do not let a page switch tabs by itself. So the app also flashes the portal tab's title
  and icon ("Your turn"), plays a short sound, and sends a desktop notification if the user allows it.
- When the portal page moves on, the agent continues and the app shows "Thanks, I continue".
- Keystrokes typed in the portal tab go only to the server browser. Suite never logs or stores them.

## Owner change (25 Nov 2026): no "Open live portal" button

- One click on the card robot ("Start") does everything: Check data, start the server browser,
  open the portal start page in live mode and the portal tab, then wait at the login.
- If required data is missing, it stops before the portal and lists what is missing. When the
  list is fixed, it continues by itself.
- The server browser is warmed when the robot panel opens, so the portal appears in about one
  second instead of 30 to 60 seconds. A warm browser that is not used stops after 2 minutes.
- Nothing starts just because a page is opened: one page view must not start a government
  portal session (cost, account lockouts, and every manager who views the page would start one).
