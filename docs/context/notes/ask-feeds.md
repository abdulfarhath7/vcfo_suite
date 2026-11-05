# Ask VCFO official-update watchers — gotchas (paid for on 2026-10-22/23)

The watchers live in `src/lib/ask/feeds/`. One file per government source;
`registry.ts` lists them and maps each to the owner's portal list. The poller
(`poll.ts`) runs every 30 minutes (`src/jobs/ask-feeds.ts`) and from the
Sources page button. New items wait in the manager's review queue.

## Which portal gives what (the owner's PDF list, checked 2026-10-23)

| Portal in the list | What we read | How |
|---|---|---|
| GST portal `services.gst.gov.in/services/gstlaw/gstlawlist` | Its "GST Law" page is a page of links; it sends you to CBIC for notifications. We read CBIC (`cbic.ts`, JSON) **and** the portal's own "News and Updates" advisories (`gst-portal.ts`) | CBIC: plain HTTPS with the Sectigo intermediate embedded (`govt-https.ts`). Portal news: **real browser only** (below) |
| Income Tax `incometaxindia.gov.in` | Refuses programs and headless Chrome (Akamai "Access Denied"). The department's e-filing portal `incometax.gov.in/iec/foportal/latest-news` lists the same CBDT notifications/circulars with PDFs on the same host | plain HTTPS (`income-tax.ts`) |
| MCA `mca.gov.in` | Refuses programs and headless Chrome. Every MCA notification is published in the Gazette of India: `mca-egazette.ts` drives the e-Gazette "Search by Ministry" click-through (session lives in the URL, so it must be a browser), reads the results table (subject · issue date · gazette id) and downloads the PDF by id: `egazette.gov.in/WriteReadData/<year>/<serial>.pdf`. Searches this month, plus last month in the first week. Ministry staff matters (service rules, tenure, appointments) are skipped | **real browser** (`mca-egazette.ts`) |
| EPFO | Notices RSS `epfo.gov.in/?post_type=notices&feed=rss2`, employer-relevant only. The old `circulars.php` archive stopped in 2025; the new site posts its circulars as notices ("Circular Dated 28.09.2026", "Wage Ceiling Circular 28.09.2026", checked 2026-11-05), so the RSS carries them | RSS (`epfo.ts`) |
| ESIC `esic.gov.in/circulars` | Circulars table, employer-relevant only | HTML (`esic.ts`) |
| Telangana Commercial Taxes `tgct.gov.in/tgportal/` | "Announcements › View More" — PDF links **without dates**; dated the day first seen, the title says so. Profession Tax GO page: postback links, newest 2021 | HTML (`tgct.ts`) |
| DGFT `dgft.gov.in/CP/?opt=regulatory-updates` | That hub links to four tables: notifications, public notices, circulars, trade notices — all read | HTML (`dgft.ts`) |
| RBI (FEMA) | Notifications RSS filtered to FEMA. A few notices are PDF-only behind a browser check → recorded once as "manual" | RSS (`rbi.ts`) |

## The GST portal needs a real browser

`gst.gov.in` fronts every request with an F5 anti-robot challenge (a script
the client must run; `window["bobcmn"]` in the HTML). `fetch`/curl get the
challenge page, never the data. Real Chrome passes, and the news page then
calls `/fomessage/newsupdates` → `{ data: [{ id, title, module, content, date
(dd/mm/yyyy), IsExternal, linkURl }] }` with the full text of each item.

`browser-fetch.ts` opens the page in headless Chromium through Playwright
and returns the body of that data call. Locally it uses the installed Google
Chrome (`channel: 'chrome'`). On a server set `ASK_FEEDS_BROWSER` to a
Chromium executable. The production image is `node:22-alpine` and has no
browser: add `RUN apk add --no-cache chromium nss freetype harfbuzz ttf-freefont`
to the runner stage and `ASK_FEEDS_BROWSER=/usr/bin/chromium`. `playwright`
is in `serverExternalPackages` (next.config.mjs) so it is required at run
time, not bundled; it is installed by `npm ci` (a dependency of
`@playwright/test`). Until that is done in production, the GST-portal
watcher reports "needs a browser" on the Sources page and nothing else is
affected.

## The e-Gazette click-through (MCA)

Home → "Search" postback → `#btnMinistry` → `#ddlMinistry` (each select is a
postback, wait for navigation) → `#ddlmonth` → `#ddlyear` → `#ImgSubmitDetails`.
A direct link to `SearchMenu.aspx` lands on `error.aspx`. The server log prints
`[ask-feeds] e-Gazette Ministry of Corporate Affairs YYYY-MM: N gazette(s) listed`
so "0 added" can be told apart from "nothing found".

**Known gap: MCA General Circulars.** The owner's PDF circles both "Notifications" and
"Circulars" on the MCA e-book page. Notifications reach us through the Gazette; General
Circulars are not printed in the Gazette, and `mca.gov.in` answers 403 to automated readers
(checked again 2026-11-05). We do not disguise a program as a person to get past that block. Until
MCA offers a feed, circulars are added by hand on the Sources page (upload), which goes through
the same review gate.

**egazette.gov.in sends an incomplete certificate chain** (Let's Encrypt YR1, checked
2026-11-05), like CBIC. Gazette PDFs download through `govtGetBytes` in `govt-https.ts`, which
adds YR1 and the ISRG Root YR cross-signed by ISRG Root X1. Before this, every new gazette
failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` and was retried each run.

## The 30-minute timer needs Inngest running

The cron in `src/jobs/ask-feeds.ts` is executed by Inngest, not by Next. On
the owner's laptop that means a second terminal: `npm run inngest:dev`
(dev server on :8288; it discovers the app at `http://localhost:3000/api/inngest`,
or `curl -X PUT` that URL to register). Found on 2026-10-26: nothing had
arrived for two days because no Inngest server was running — every item so
far had come from the Sources page button. In production, `INNGEST_EVENT_KEY`
+ `INNGEST_SIGNING_KEY` on App Runner do the same job (AWS-DEPLOY.md).
Government portals also publish almost nothing on weekends.

## Without Inngest: the Windows scheduled task (2026-11-04)

The owner asked for updates to be captured even when `npm run dev` and Inngest are not
running. `npm run ask:feeds:schedule` registers a Windows scheduled task,
"VCFO official updates (every 30 min)", that runs `scripts/ask-feeds-scheduled.ps1`
every 30 minutes and at log-on as the signed-in user (no admin, no stored password).
The runner starts Docker Desktop and `docker compose up -d` when Postgres is not
reachable, then runs `npm run ask:feeds:once`; output goes to `.logs/ask-feeds.log`.
`-- status`, `-- run` and `-- remove` inspect, trigger and uninstall it.

- A run missed while the laptop was off or asleep starts when it is back
  (`StartWhenAvailable`), and a skipped run loses nothing: each watcher looks back
  `MAX_AGE_DAYS` and the `(feed_id, external_id)` unique index drops repeats. After a long
  gap `MAX_NEW_PER_WATCHER` spreads the backlog over a few runs.
- Running it next to `npm run inngest:dev` is safe for the same reason (duplicates are dropped).
- Nothing on the laptop runs while it is off; only the deployed app with the Inngest keys
  watches around the clock.
- "review pdf failed … reading 'S'" (fixed 2026-11-05): `ask:feeds:once` used to run with
  `--conditions=react-server`, which loads React's server build, and @react-pdf/renderer cannot
  render with it. When Inngest was down the script indexed inline, so every item it captured
  (the scheduled task's normal case) had no review PDF. The script now preloads
  `scripts/allow-server-only.mjs`, which only empties `server-only`. Do not put the
  react-server flag back on any script that renders a PDF.
- Gazettes are printed in Hindi and English and the review PDF's built-in font has no Hindi
  letters: `latinExcerpt` keeps the English lines, and `readingCheck` does not count Hindi as
  unreadable.

## Other gotchas

- `MAX_AGE_DAYS = 60` and `MAX_NEW_PER_WATCHER = 10` per check: DGFT and
  EPFO archives hold years; the queue is for what is new.
- `isRecentEnough` compares calendar days in UTC; tests pass `now`.
- `ManualFetchError` (types.ts): the source lists the item but will not give
  a program the file → saved once as `failed` with the instruction, never
  retried. Used by RBI.
- The review PDF (`review-pdf.ts`) is built from extracted text; for a
  text-only item (GST portal advisory, Income Tax text line) the "pieces
  read" count is small and that is fine.
- Act labels (`FeedAct`) feed the `getRecentOfficialUpdates` tool enum and
  the announcement category map in `src/lib/regulatory/notify.ts` — add a new
  act in both places or `tsc` fails.
