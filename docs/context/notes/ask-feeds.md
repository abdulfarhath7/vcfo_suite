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
| EPFO | Notices RSS `epfo.gov.in/?post_type=notices&feed=rss2`, employer-relevant only. The old `circulars.php` archive stopped in 2025 | RSS (`epfo.ts`) |
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

## The 30-minute timer needs Inngest running

The cron in `src/jobs/ask-feeds.ts` is executed by Inngest, not by Next. On
the owner's laptop that means a second terminal: `npm run inngest:dev`
(dev server on :8288; it discovers the app at `http://localhost:3000/api/inngest`,
or `curl -X PUT` that URL to register). Found on 2026-10-26: nothing had
arrived for two days because no Inngest server was running — every item so
far had come from the Sources page button. In production, `INNGEST_EVENT_KEY`
+ `INNGEST_SIGNING_KEY` on App Runner do the same job (AWS-DEPLOY.md).
Government portals also publish almost nothing on weekends.

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
