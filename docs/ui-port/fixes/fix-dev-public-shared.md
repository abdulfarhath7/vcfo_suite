# Developer console, public pages and shared staff screens (P-251 to P-645), round 2

Round 1 left this area half done: the dev routes, repositories and parsers were built, the Overview view was rewritten, and the Vault, Audit log, Notifications and Profile were reworked. Round 2 fixed the type error, wired the write actions into the screens, added the missing routes and checked the round-1 claims I relied on. Rows I did not reach say so; their status is the one in PROTOTYPE-DIFF.md.

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-251 | ✓ | It was already the same. |
| P-252 | ✓ | New `app/app/dev/page.tsx` redirects `/app/dev` to `/app/dev/overview`. The dev layout still guards the role. |
| P-253 | ✓ | It was already the same. |
| P-254 | ◐ (shared) | Needs a badge on Connections and Jobs in `RoleSidebar.tsx` (shell agent). The counts are in `/api/dev/overview` (services partly set, jobs failed today). |
| P-255 | ◐ (shared) | Shell file. Request: show the developer items when the super admin is inside `/app/dev`. |
| P-256 | ✗ (shared) | Shell file. Request: `tabBarTabs('developer')` should return Overview, Jobs (Terminal icon), Connections. |
| P-257 | ◐ (shared) | Shell file. Request: no Notifications bell for the developer, or point its history link somewhere real. |
| P-258 | ✗ (shared) | `src/lib/auth-routes.ts` is not mine. Blocked by P-259. |
| P-259 | ✗ (stays) | No backend: the account and profile routes use `currentContext()` without `allowDeveloper`, so AccountSettings would get 401/403 for a developer (G-01). Opening the profile APIs to the developer role is a guard change for the hub. |
| P-260 | ✗ (stays) | Same as P-259. |
| P-261 | ✗ (stays) | Same as P-259. |
| P-262 | ✓ | It was already the same. |
| P-263 | ✓ | It was already the same. |
| P-264 | ✓ | Every dev grid now passes `stickyFirstColumn` (Overview, Connections, Jobs, Logs, Deploys, Audit, Outlook); the services grid also `stickyHead`. |
| P-265 | ✓ | Picked rows are tinted with `pickedRow` through `rowClassName` on Connections and Logs (no change to EFilingGrid needed). |
| P-266 | ✓ | Console writes exist and are audited: job retry (`dev.job.retry`, ok or failed), redeploy (`dev.deploy.start`), Outlook disconnect (`dev.outlook.disconnect`, with before and after). `devAction` now also writes a `dev.action.denied` row when a signed-in non-developer tries a write. Test: `src/lib/dev/route-helpers.test.ts`. |
| P-267 | ✓ | It was already the same. |
| P-268 | ✓ | It was already the same. |
| P-269 | ✓ | It was already the same. |
| P-270 | ✓ | Round 1: the chip reads "Production <version>" from the image tag or digest (`imageVersion`), or the App Runner state word when not running. |
| P-271 | ◐ (real only) | Kept the real "N staff signed in" link. |
| P-272 | ✓ | Round 1: value with the small "/ M" through `of`, href Connections. |
| P-273 | ✓ | All three missing tiles are built from real readings (round 1, checked): "Connections healthy" (switched-on services fully set plus fresh Outlook links), "Secrets to fix" (required secret names not set plus seeded demo logins), "Errors, 24 hours" (CloudWatch error lines, "+" when capped). The `/api/dev/overview` route returns `secrets`, `errors24h` and `costsMonth`. |
| P-274 | ◐ | No trend line: Inngest runs are not stored day by day. |
| P-275 | ✓ | Round 1: "Messages failed, 24 hours" with the stored trend line. |
| P-276 | ✓ | See P-273. Expiry dates are not stored, so the tile counts missing names and demo logins only. |
| P-277 | ◐ | Built as "Errors, 24 hours" (a count, not a rate): the app keeps no request count. |
| P-278 | ◐ (real only) | Kept as a real extra tile. |
| P-279 | ◐ (real only) | Folded into "Connections healthy" (its note shows Outlook due soon). The Outlook card stays on the overview rail. |
| P-280 | ◐ (shared) | Icons come from `cardHeadIcon` in DashHero. Request: let a stat take an `icon` (foundations). |
| P-281 | ◐ | Columns Service (name, what · provider), Status, Note. No uptime or p95 (P-282). |
| P-282 | ✗ (stays) | No data: no uptime or latency metric. |
| P-283 | ✓ | Round 1: `Cols` (main column plus 360px rail). |
| P-284 | ✓ | Round 1: `AttentionList` with the date tile tinted by urgency and Open on urgent rows. |
| P-285 | ✓ | Round 1: failed jobs, missing secrets, failed messages, log errors, partly set services, Outlook due soon, denied actions, demo logins. |
| P-286 | ✓ | It was already the same. |
| P-287 | ✗ (stays) | No data: no incident records. |
| P-288 | ◐ | Round 1: five rows with type, Production tag, time and status, plus "Deploys ›". No version or by per operation (App Runner does not give them). |
| P-289 | ◐ (real only) | Kept. |
| P-290 | ✓ | Round 1: rail card "N of M healthy", rows with kind · provider, status chip, "All ›", deep link `?c=id` (now read by Connections, P-300). |
| P-291 | ✓ | Round 1: StackedBar of five groups from Cost Explorer this month, or the not set up notice. |
| P-292 | ✗ (stays) | No data: one App Runner service, no staging. |
| P-293 | ✓ | It was already the same. |
| P-294 | ✓ | Tabs All, Needs attention, Not set up with counts that follow the Kind filter. |
| P-295 | ✓ | New FilterChip "Kind" (Email, Messaging, Storage, Jobs, AI, Security, Monitoring, Hosting) from `ServiceConfig.kind`. |
| P-296 | ✓ | Sub line is now "kind · provider". |
| P-297 | ◐ | Words come from env presence (Working, Partly set, Not set up), not a live health check. |
| P-298 | ✗ (stays) | No data: no live check or token expiry per service. |
| P-299 | ◐ | Outlook mailbox rows now have "Disconnect". Service rows have no action: no test, rotate or connect route. |
| P-300 | ✓ | `?c=<id>` opens that service; `?c=outlook` scrolls to the mailboxes card. |
| P-301 | ✓ | It was already the same. |
| P-302 | ◐ | Set and Missing env names. Endpoint, webhook, account and secret are not read. |
| P-303 | ✗ (stays) | No data: scopes not stored. |
| P-304 | ✗ (stays) | No data: no write route. |
| P-305 | ✗ (stays) | No rotate route: keys live in Secrets Manager and App Runner env; rotating needs IAM write access the app does not have. |
| P-306 | ✓ | Outlook "Disconnect" uses DangerConfirm (type DISCONNECT, Unplug icon), posts to `/api/dev/connections/outlook/disconnect`, which is guarded by `requireDeveloper` and writes the audit row with before and after. |
| P-307 | ✗ (stays) | No data: per-service settings. |
| P-308 | ✗ (stays) | No data: no DNS check. |
| P-309 | ✗ (stays) | No data: no message route table. |
| P-310 | ✗ (stays) | No data: no test send route. |
| P-311 | ✗ (stays) | No data: no connection event log. |
| P-312 | ✗ (stays) | No data: no connect route. |
| P-313 | ◐ (real only) | Kept, with the new Disconnect column. |
| P-314 | ✓ | It was already the same. |
| P-315 | ◐ | Meta keeps the real 24-hour counts. |
| P-316 | ◐ | Email and WhatsApp only: the app sends no SMS or Teams. |
| P-317 | ✓ | Tabs All, Failed, Skipped, Sent now show counts from `statusCounts` (round-1 route plus the view). |
| P-318 | ◐ | No Retries column: retries are not stored per delivery. |
| P-319 | ✓ | It was already the same. |
| P-320 | ✗ (stays) | No data: no message body or delivery steps stored. |
| P-321 | ✗ (stays) | No retry route for one message: the body is not stored, so it cannot be sent again. |
| P-322 | ✗ (stays) | No data: no route configuration. |
| P-323 | ✗ (stays) | No data: settings not editable. |
| P-324 | ✗ (stays) | Same as P-321. |
| P-325 | ✗ (stays) | No data: no DNS check. |
| P-326 | ✗ (stays) | No data: no template registry. |
| P-327 | ◐ (real only) | Kept. |
| P-328 | ◐ | Meta "Inngest · from src/jobs". |
| P-329 | ✓ | Added Duration (of the last run) and Next run (from the cron, "On event" for event jobs). Run now stays out (P-331). |
| P-330 | ◐ | The tabs stay on Recent runs, where the runs are. |
| P-331 | ✗ (stays) | No run route: a cron function cannot be started from the REST API. |
| P-332 | ✗ (stays) | No data: run log lines not read from Inngest. |
| P-333 | ✓ | New "Recent failures" card: "job · stamp", event, chip and "Retry", then "Queued again". Retry also sits on each failed row in Recent runs. A run that cannot be retried (cron or shared event) says "Waits for next run". `POST /api/dev/jobs/retry` is guarded, checks the run again and audits every try. The `RetryOutcome` narrowing error is fixed (`out.ok === false`, needed in non-strict TS). |
| P-334 | ✗ (stays) | No data: no queue facts. |
| P-335 | ✗ (stays) | No data: no pause route. |
| P-336 | ◐ (real only) | Kept, with the Retry column. |
| P-337 | ◐ | Meta stays the log group name. |
| P-338 | ◐ | No counts: the level filter runs in CloudWatch, so other levels are not loaded. |
| P-339 | ✓ | Added the "Source" FilterChip (from the line tag); the period tabs stay as a real extra. |
| P-340 | ✓ | It was already the same. |
| P-341 | ✓ | Columns are now Time, Level, Source, Message, Request ID (round-1 parser fields). |
| P-342 | ✓ | Panel shows Level, Source, Request ID, Instance and the message. |
| P-343 | ✗ (stays) | No data: retention not editable. |
| P-344 | ✓ | It was already the same. |
| P-345 | ◐ | Production service facts, plus a "Redeploy" button. No staging. |
| P-346 | ✓ | "Redeploy" opens the new `ChangeConfirm` (before and after), posts to `/api/dev/deploys/redeploy` (guarded, audited `dev.deploy.start`, 409 while busy). It rolls out the current image; a new version still comes from the pipeline. |
| P-347 | ◐ | App Runner operations carry no version, by or note. |
| P-348 | ✗ (stays) | No data: App Runner keeps no list of earlier images to roll back to. |
| P-349 | ✗ (stays) | No data: no commit or notes per operation. |
| P-350 | ✗ (stays) | No data: migrations table not read. |
| P-351 | ✗ (stays) | No data: no feature flags. |
| P-352 | ✓ | It was already the same. |
| P-353 | ✗ (stays) | No data: sign-in method not counted. |
| P-354 | ✗ (stays) | No data: rules not editable. |
| P-355 | ✗ (stays) | No data: no console settings. |
| P-356 | ◐ | Kept the real Role and People grid. |
| P-357 | ✗ (stays) | No data: no device, browser or place per session. |
| P-358 | ✗ (stays) | No data: no key inventory. |
| P-359 | ✗ (stays) | No data: no rotate route. |
| P-360 | ✗ (stays) | No data: no write route. |
| P-361 | ◐ (real only) | Kept "Staff sign-in", which covers all staff. |
| P-362 | ◐ (real only) | Kept. |
| P-363 | ✗ (stays) | No data: no service account list. |
| P-364 | ◐ (real only) | Kept. |
| P-365 | ✗ (stays) | No data: no RDS backup reader. |
| P-366 | ✗ (stays) | No data: no volume counts. |
| P-367 | ◐ | No budget or last month: Cost Explorer reads 30 days only. |
| P-368 | ◐ | Same as P-367. |
| P-369 | ✗ (stays) | No data: Cost Explorer reads 30 days only. |
| P-370 | ✗ (stays) | No data: no S3 reader. |
| P-371 | ◐ | No growth or vacuum date. |
| P-372 | ✗ (stays) | No data: no snapshot reader. |
| P-373 | ✗ (stays) | No data: no export list. |
| P-374 | ✓ | It was already the same. |
| P-375 | ◐ | Meta "System and access · newest first": the keep period is not configured in the app. |
| P-376 | ✓ | Added FilterChips Actor, Action (on the loaded rows) and Date (Today, 7 days, 30 days, server side through `days`), and "Clear all". |
| P-377 | ✓ | Added Before and After columns from the audit metadata (round-1 `beforeAfter`). Older rows show "-". |
| P-378 | ✓ | It was already the same. |
| P-379 | ✓ | It was already the same. |
| P-380 | ✓ | It was already the same. |
| P-381 | ✓ | It was already the same. (round 1, kept) |
| P-382 | ✓ | It was already the same. (round 1, kept) |
| P-383 | ✓ | It was already the same. (round 1, kept) |
| P-384 | ◐ (real only) | The landing still scrolls to a `#section` after the intro, so the "/#journey" links from /roles keep working. (round 1, kept) |
| P-385 | ✓ | It was already the same. (round 1, kept) |
| P-386 | ✓ | It was already the same. (round 1, kept) |
| P-387 | ◐ (stays) | "Sign in" goes to `/login`, which is the real Auth.js page. The tool has no `/sign-in` route, and renaming the route is outside this task. (round 1, kept) |
| P-388 | ✓ | The nav "Book a demo" is now a button that opens the Book a demo dialog. (round 1, kept) |
| P-389 | ✓ | It was already the same. (round 1, kept) |
| P-390 | ✓ | It was already the same. The prototype's phone menu has no Book a demo item either. (round 1, kept) |
| P-391 | ✓ | It was already the same. (round 1, kept) |
| P-392 | ✓ | The hero "Book a demo" opens the dialog. (round 1, kept) |
| P-393 | ✓ | It was already the same. (round 1, kept) |
| P-394 | ◐ (stays) | "Try it live" opens `/login`, which is the real sign-in page (see P-387). (round 1, kept) |
| P-395 | ✓ | It was already the same. (round 1, kept) |
| P-396 | ✓ | The hero frame and both floating cards now carry `data-app` and `role="button"`. A click or Enter opens Book a demo. They cannot open a live screen because the tool has no public demo portal. (round 1, kept) |
| P-397 | ✓ | I ported the prototype's `[data-app]` CSS rules to `landing.css` with the `--lp-*` tokens. The hover and focus pill says "Book a demo", not "Open live screen". (round 1, kept) |
| P-398 | ✓ | It was already the same. (round 1, kept) |
| P-399 | ✓ | Each fact is a click-through item. On hover the number turns blue. (round 1, kept) |
| P-400 | ✓ | It was already the same. (round 1, kept) |
| P-401 | ✓ | The journey nodes and list rows are click-through items. A node gets the brighter ring on hover or focus. (round 1, kept) |
| P-402 | ✓ | It was already the same. (round 1, kept) |
| P-403 | ✓ | It was already the same. (round 1, kept) |
| P-404 | ✓ | The pin cards and the phone list cards are click-through items. (round 1, kept) |
| P-405 | ✓ | It was already the same. (round 1, kept) |
| P-406 | ✓ | The cluster cards and the registration chips are click-through items. A chip gets the blue edge and fill on hover. (round 1, kept) |
| P-407 | ✓ | It was already the same. The ring is also a click-through item now. (round 1, kept) |
| P-408 | ✓ | The reminder card is a click-through item ("Book a demo to see notifications"). (round 1, kept) |
| P-409 | ✓ | All three screenshots are click-through items. (round 1, kept) |
| P-410 | ✓ | It was already the same. (round 1, kept) |
| P-411 | ✓ | It was already the same. (round 1, kept) |
| P-412 | ✓ | The comparison "Book a demo" is a button that opens the dialog. (round 1, kept) |
| P-413 | ✓ | It was already the same. (round 1, kept) |
| P-414 | ◐ (kept) | Each portal screenshot now opens Book a demo, as in the prototype. I kept the "See the ... portal" buttons as a visible keyboard path, and they now open the dialog instead of going to `/contact`. (round 1, kept) |
| P-415 | ✓ | The portal screenshots (tab panels) carry `data-app`. A click opens Book a demo. (round 1, kept) |
| P-416 | ✓ | It was already the same. (round 1, kept) |
| P-417 | ✓ | The Ask panel and its three questions are click-through items ("Book a demo to try Ask VCFO"). (round 1, kept) |
| P-418 | ✓ | It was already the same. (round 1, kept) |
| P-419 | ✓ | The credentials card and the audit card are click-through items. (round 1, kept) |
| P-420 | ✓ | It was already the same. (round 1, kept) |
| P-421 | ◐ | The closing "Book a demo" opens the dialog. "Try it live" still opens `/login` (see P-387). (round 1, kept) |
| P-422 | ✓ | The footer "Book a demo" opens the dialog, as in the prototype (`href="#demo"`, the click is prevented). (round 1, kept) |
| P-423 | ✓ | Every `data-app` item has `tabIndex={0}`, `role="button"` and `aria-haspopup="dialog"`, and shows a focus outline. Enter (and Space) opens the dialog. I used `role="button"`, not "link", because the item opens a dialog and goes to no page. (round 1, kept) |
| P-424 | ✓ | It was already the same. (round 1, kept) |
| P-425 | ✓ | It was already the same. (round 1, kept) |
| P-426 | ✓ | It was already the same. (round 1, kept) |
| P-427 | ✓ | It was already the same. (round 1, kept) |
| P-428 | ✓ | It was already the same. (round 1, kept) |
| P-429 | ✓ | It was already the same. (round 1, kept) |
| P-430 | ◐ (stays) | "Every answer can show you where it sits on this page" is the true sentence. The real landing has no screen to open (see P-434). (round 1, kept) |
| P-431 | ✓ | It was already the same. (round 1, kept) |
| P-432 | ✓ | It was already the same. (round 1, kept) |
| P-433 | ✓ | It was already the same. (round 1, kept) |
| P-434 | ✗ (stays) | No data: there is no public demo portal, so "Open the screen" has no screen to open. "Book a demo" covers this action. (round 1, kept) |
| P-435 | ✓ | "Book a demo" in an answer is a button that opens the dialog. It is primary for sales answers and ghost for the others. (round 1, kept) |
| P-436 | ✓ | The small primary "Book a demo" opens the dialog. (round 1, kept) |
| P-437 | ✓ | It was already the same. (round 1, kept) |
| P-438 | ✓ | The new `BookDemoDialog` is the prototype's small modal (420 px on the scrim, 52 px head, footer). It opens over the landing and the sign-in page. `/contact` still works as a page for direct links and the marketing nav. (round 1, kept) |
| P-439 | ◐ (stays) | `/contact` stays inside `MarketingShell`, which also frames `/roles` and carries the marketing nav. The dialog is the prototype part. (round 1, kept) |
| P-440 | ✓ | I removed the Aurora wash from `/contact`. The page has a plain surface and the dialog look. (round 1, kept) |
| P-441 | ✓ | The dialog title is "Book a demo". `/contact` uses the same 52 px head and no longer has the eyebrow, the rule or the serif heading. (round 1, kept) |
| P-442 | ✓ | The dialog has three required fields: Name, Firm and Work email. `/contact` keeps "How can we help?" as an extra field, now optional (the route already accepts no message), and Firm is required there too. (round 1, kept) |
| P-443 | ✓ | The dialog and `/contact` use the R-47 `Input`/`Textarea` (40 px, 1.5 px edge, 6 px corners) with a 13 px label above (`DemoField`). (round 1, kept) |
| P-444 | ✓ | The footer button says "Send" ("Sending" while the request posts). (round 1, kept) |
| P-445 | ✓ | The sent state says "Request sent to SBC. The reply goes to <email>." and shows a primary Close button. (round 1, kept) |
| P-446 | ◐ (real only) | The real dialog really posts to `/api/public/demo-request`, so a red error line shows when the post fails (rate limit, bad email). The prototype sends nothing. (round 1, kept) |
| P-447 | ◐ (real only) | The dialog has no sign-in link. `/contact` keeps a small "Already have an account? Sign in" line under the card. (round 1, kept) |
| P-448 | ◐ (stays) | The route stays `/login` (see P-387). (round 1, kept) |
| P-449 | ✓ | It was already the same. (round 1, kept) |
| P-450 | ✓ | It was already the same. (round 1, kept) |
| P-451 | ✓ | The middle peak band is `fill-highlight-bright` at 7%, which is the orange brand colour. (round 1, kept) |
| P-452 | ◐ (stays) | No token matches navy-2 and stays dark in both modes. `navy-fill-hover` flips to light in dark mode, so the band stays on `side-hover`. Request: add a `side-deep` token (navy-2, #0F2D4D light, #111C30 dark). (round 1, kept) |
| P-453 | ✓ | It was already the same. (round 1, kept) |
| P-454 | ✗ (stays) | The tool has no sample mode, so it would be false to say "Live prototype, sample data". When `NEXT_PUBLIC_DEMO_LOGINS=on`, the card shows the honest label "Demo accounts" over the buttons. (round 1, kept) |
| P-455 | ✓ | It was already the same. (round 1, kept) |
| P-456 | ◐ (stays) | The card keeps `shadow-dialog`. The prototype value is an rgba literal, and components may not hold colour literals. Request: add a `shadow-signin` token if the exact value matters. (round 1, kept) |
| P-457 | ✓ | The card peak band is `bg-brand-text` at 7%, the darker accent blurple that the prototype's `--accent` maps to. (round 1, kept) |
| P-458 | ✓ | The 30 px "V" tile is `bg-highlight-bright` (orange) with `text-on-brand` (white). (round 1, kept) |
| P-459 | ✓ | It was already the same. (round 1, kept) |
| P-460 | ◐ (real only) | I kept the theme toggle in the logo row. It is a real feature. (round 1, kept) |
| P-461 | ✓ | It was already the same. (round 1, kept) |
| P-462 | ✓ | It was already the same. (round 1, kept) |
| P-463 | ◐ (real only) | I kept the show-password button. It is a real feature. (round 1, kept) |
| P-464 | ◐ (real only) | The error line keeps the Auth.js message, which can say more than a mismatch (locked out, two-step). (round 1, kept) |
| P-465 | ✓ | The button now has the dark-mode accent edge (`dark:border dark:border-brand-line`). It stays disabled until both fields have text, which is real only. (round 1, kept) |
| P-466 | ◐ (real only) | I kept the spinner and "Signing in". Real sign-in takes time. (round 1, kept) |
| P-467 | ✓ | The "Demo accounts" grid (three a row, outline buttons, a hairline above) shows only when `NEXT_PUBLIC_DEMO_LOGINS === 'on'`. A button only fills the work email with a seeded login and focuses the password field. No password is in the bundle. There are five buttons (Client, Lead, Manager, Admin, Super admin) because the seed creates no developer login. (round 1, kept) |
| P-468 | ◐ (real only) | I kept the "Forgot your password?" button and its "Need a new password?" dialog. The words around it are the same as the prototype. (round 1, kept) |
| P-469 | ✓ | "No account yet? Book a demo" is a button that opens the Book a demo dialog on the sign-in page. (round 1, kept) |
| P-470 | ✗ (stays) | It is the same reason as P-454: the tool has no sample data. (round 1, kept) |
| P-471 | ◐ (real only) | I kept the two-step code step. (round 1, kept) |
| P-472 | ◐ (real only) | I kept the notices. (round 1, kept) |
| P-473 | ✓ | It was already the same. (round 1, kept) |
| P-474 | ✗ (stays) | No data: the tool has no public demo portals to list. (round 1, kept) |
| P-475 | ◐ (real only) | I left `/roles` as it is. The marketing footer links to it. (round 1, kept) |
| P-476 | ✓ | It was already the same. |
| P-477 | ✓ | It was already the same. |
| P-478 | ◐ (real only) | Kept: writers post from this page. The prototype has no composer. |
| P-479 | ◐ (real only) | Kept the real composer (Type chips with the R-10 fill, Message, Source link). Announcements have no audience field. |
| P-480 | ✓ | It was already the same. |
| P-481 | ✓ | It was already the same. |
| P-482 | ✓ | It was already the same. |
| P-483 | ✓ | It was already the same. |
| P-484 | ✓ | It was already the same. |
| P-485 | ✓ | The by-line is "Official feed" or "From <name>" only; the time is gone (the date tile carries the date). |
| P-486 | ✓ | The main line is the title, medium when unread; the body follows as a muted line when it says more. |
| P-487 | ✓ | The host tag shows from sm up; on a phone the host joins the by-line. |
| P-488 | ✓ | It was already the same. |
| P-489 | ◐ (real only) | Kept the writers' trash button: it is the only way to remove an announcement. |
| P-490 | ✓ | It was already the same. |
| P-491 | ✓ | L1 loading shapes: a 44 px tile, the 104 px mark, a by-line and a main line per row. |
| P-492 | ✓ | A row now opens the new `AnnouncementDetailDialog`: the title is the dialog heading, then the kind chip, "Important" tag and the date and time. The live popup stays for new arrivals. |
| P-493 | ✓ | Previous and next buttons and "3 / 8" in the footer step through the rows the list shows; arrow keys work too. |
| P-494 | ◐ | Sender row: initials face, name, role and time, or "Official feed" with a host button. No WhatsApp or Email tiles: announcements store no author email or phone. |
| P-495 | ✓ | "Open" (the source link) and primary "Got it". |
| P-496 | ✓ | `headIcon` gives the card the Landmark tile, blue. |
| P-497 | ✓ | It was already the same. |
| P-498 | ✓ | It was already the same. |
| P-499 | ◐ (real only) | Kept: admins manage the official RSS feeds here. |
| P-500 | ✓ | It was already the same. |
| P-501 | ✓ | It was already the same. |
| P-502 | ✓ | It was already the same. |
| P-503 | ✓ | It was already the same. |
| P-504 | ✓ | Round 1, checked: SpectrumTabs All, Unread and one tab per real type group (Steps, Documents, Requests, Team, Email) with counts. The groups are the tool's own notification kinds. |
| P-505 | ◐ (real only) | Kept the real Direction filter (Received or Sent) as a compact FilterChip in the head; the date filter is a FilterChip too. |
| P-506 | ✓ | Round 1, checked: the type is a tab, as in the prototype; no separate type chip. |
| P-507 | ✓ | It was already the same. |
| P-508 | ✓ | It was already the same. |
| P-509 | ✓ | Round 1, checked: the title is a link that marks the row read; a row with no page opens the panel. |
| P-510 | ◐ | Round 1, checked: the body shows as one line. Notifications store plain text, so there are no inline links. |
| P-511 | ◐ | Round 1, checked: 104 px chip and a 150 px "client · when" column from sm up. The client is not a link: the row has no team page to point at. |
| P-512 | ✓ | Round 1, checked: the dot is a "Mark as read" button. |
| P-513 | ✓ | Round 1, checked: a 30 px outline arrow button opens the side panel. |
| P-514 | ✓ | Round 1, checked: Sheet with eyebrow, title, chip, From / When (IST) / Area, the body and an "Open" CTA to the item's page. There is no separate step card. |
| P-515 | ◐ (real only) | Kept the "Cleared" tag for items cleared from the inbox. |
| P-516 | ✓ | Round 1, checked: "This month", counted over the month. |
| P-517 | ✓ | Round 1, checked: 26 px number and "this month"; a click opens the drill. |
| P-518 | ✓ | Round 1, checked: stacked bar over the real groups with status tokens (Steps brand, Documents warning, Requests waiting, Team upcoming, Email positive). |
| P-519 | ✓ | Round 1, checked: 44 px rows with dot, name, count and chevron; a click opens the drill on that group. |
| P-520 | ✓ | Round 1, checked: "This month" dialog with group tabs, rows that open the panel, and "Show in the list". |
| P-521 | ✓ | Round 1, checked: "You get these by" with In-app, Email and WhatsApp (from the person's own profile) and "Change in Settings ›". |
| P-522 | ✓ | It was already the same. |
| P-523 | ✓ | It was already the same. |
| P-524 | ✓ | Round 1, checked: L1 rows with a tile, two lines and a chip shape. |
| P-525 | ✓ | It was already the same. |
| P-526 | ✓ | It was already the same. |
| P-527 | ✓ | Round 1 removed the PlainPageHead; the grid card is the page (R-09). Checked. |
| P-528 | ✓ | Round 1: the segmented switch sits above the card. |
| P-529 | ✓ | Round 1: the AuditTable head has `CardHeadTile`. Checked. |
| P-530 | ✓ | It was already the same. |
| P-531 | ✓ | It was already the same. |
| P-532 | ✓ | Round 1, checked: All areas plus Documents, Milestones, Projects, Team, Email, Credentials, Sign-in and Other, each with a count. Tested in the new `audit-filters.test.ts`. |
| P-533 | ✓ | Round 1, checked: Everyone, SBC, then each role (Super admin, Admin, Manager, Project lead, Client). |
| P-534 | ✓ | It was already the same. |
| P-535 | ✓ | Round 1, checked: 120 px blurple date link that opens the day dialog. |
| P-536 | ✓ | It was already the same. |
| P-537 | ✓ | It was already the same. |
| P-538 | ✓ | It was already the same. |
| P-539 | ✓ | Round 1, checked: a 124 px chip on every row: Done, Sent back, Failed, Denied. |
| P-540 | ◐ (real only) | Kept the Target column on the all-events view (project and target type); the project view leaves it out. The Event second line carries the summary. |
| P-541 | ◐ (shared) | The pager is `EFilingGrid` (foundations): page numbers only from two pages. Request: an always-on "1–25 of N" footer with previous and next. |
| P-542 | ✓ | It was already the same. |
| P-543 | ✓ | Round 1, checked: date eyebrow, action title, area pill and result chip in the head, then Summary, Target and By. |
| P-544 | ✓ | Round 1: Before / After block in the side panel. Checked. |
| P-545 | ✓ | Round 1: "Open project" in the panel footer for staff (none for clients). |
| P-546 | ✓ | Round 1, checked: `AuditDayDialog` with tabs for up to seven days with events, rows with time, event and area pill, and a row opens the panel. |
| P-547 | ✓ | It was already the same. |
| P-548 | ✓ | Round 1, checked: the grid's own loading rows inside the table (`EFilingGrid loading`). |
| P-549 | ✓ | Round 1: AuditTable passes `stickyFirstColumn`. Checked. |
| P-550 | ✓ | It was already the same. |
| P-551 | ✓ | The back chevron is gone; the path is "All › folder" in muted text with the current folder in ink. |
| P-552 | ✓ | It was already the same. |
| P-553 | ✓ | It was already the same. |
| P-554 | ✓ | It was already the same. |
| P-555 | ✓ | It was already the same. |
| P-556 | ✓ | The first spine is now `identity-mid`. `bg-brand` is the class table's match for the prototype's accent-mid, so the others already matched. |
| P-557 | ✓ | It was already the same. |
| P-558 | ◐ (real only) | The title now opens the staff reader. Uploader, size, Download and Delete stay, because they are real features. |
| P-559 | ◐ (shared) | `file-badge.tsx` belongs to foundations. Request: DOCX in brand blurple, ZIP in upcoming grey, semibold text. |
| P-560 | ✓ | It was already the same. |
| P-561 | ✓ | It was already the same. |
| P-562 | ✓ | Upload and new folder now show the A1 toast with Undo (`toastSaved`). Undo deletes what was just made through the existing DELETE routes, which only admins and managers may call, so a lead's toast has no Undo. |
| P-563 | ✓ | It was already the same. |
| P-564 | ✓ | L1: the Shelves card keeps its place with block shapes, and the Documents card shows row shapes through `DashSection loading`. |
| P-565 | ✓ | New routes `app/app/{admin,manager,intern}/knowledge-bank/[id]/page.tsx` render the new `src/views/knowledge-bank/KnowledgeReader.tsx`. The document rows link to it. |
| P-566 | ◐ | Head: folder tag, "Updated <date>" chip, file badge, title and description. A file has no depth, minutes or official link. |
| P-567 | ◐ | Body: the file itself (PDF in the browser viewer, image, or the no-preview card with Download) through the short-lived signed link from the download route. The knowledge bank holds files, not written articles, so it has no timeline or sources. |
| P-568 | ◐ | Actions: Download, Copy link, and Delete for admins and managers (DangerConfirm, the existing DELETE route writes the audit row). Save to library and PDF brief belong to Ask explanations. |
| P-569 | ◐ | Side cards: "About this file" (folder, file, size, added by, date) and "More in <folder>". The bank has no client link. |
| P-570 | ✓ | It was already the same. |
| P-571 | ✓ | Round 1 removed the page title (R-09). Checked: no visible h1. |
| P-572 | ✓ | It was already the same. |
| P-573 | ✓ | It was already the same. |
| P-574 | ✓ | Round 1: the "Status" R-10 toggle shows the row glyphs. |
| P-575 | ✗ (stays) | The vault rows carry no replaced flag. |
| P-576 | ✓ | It was already the same. |
| P-577 | ✓ | Round 1: "Download N selected" or "Download all". |
| P-578 | ✓ | Round 1: "Upload · N requested". |
| P-579 | ✓ | Round 1: "Open project" or "Open client" with the arrow. |
| P-580 | ✓ | It was already the same. |
| P-581 | ✓ | It was already the same. |
| P-582 | ✓ | Round 1, checked: phase rows show a count; step rows show the 54 px review bar (green, blurple, amber) and "ok/total". |
| P-583 | ✓ | Round 1: folder rows have the "…" menu (ZIP, expand, collapse, copy link). |
| P-584 | ◐ | Round 1, checked: 22 x 18 mini type tile. No dashed missing-file box, because the tree lists stored files only (requests sit in their own card). |
| P-585 | ✓ | Round 1: `VaultStatusGlyph` behind the Status toggle. |
| P-586 | ◐ | Section tag and upload date. No "Replaced" or "Older than 2 months" tag: the vault rows carry no version or validity data, and age alone would flag every incorporation file. |
| P-587 | ✓ | Round 1: file rows have the "…" menu (Download, Open in viewer, Copy link with the C key). Checked; I fixed the lint error on the tree (`tabIndex={-1}`). |
| P-588 | ✓ | It was already the same. |
| P-589 | ✓ | Round 1, checked: 52 px head with badge, name, review status chip, the Eye button to the viewer route (now live) and Download. |
| P-590 | ◐ (real only) | The pane shows the real PDF or image, not a paper drawing; the Eye button opens the full viewer. |
| P-591 | ✓ | Round 1, checked: "Preview not available for this file type" and a primary Download. |
| P-592 | ◐ | Requests stay in their own card under the explorer: the tree has no missing-file rows to drop onto. |
| P-593 | ◐ | Client, Step, Date, File. No From (vault rows store no uploader) and no Verify (no portal link per file). |
| P-594 | ◐ (real only) | Kept the real review controls: chip, In review, Send back with a note, Approve. |
| P-595 | ◐ | Round 1, checked: "Upload · <client>" dialog with a drop zone and the A1 toast. No request picker: an upload is stored against a step field, and linking it to a document request needs a route that closes the request. |
| P-596 | ✗ (stays) | No vault delete route; documents belong to the checklist step. |
| P-597 | ✓ | Upload and review now use the A1 toast with the status tile (review switched in round 2); link copy has Undo-style toast, ZIP keeps its info toast. |
| P-598 | ✓ | Round 1, checked: dashed "No documents yet" with "Upload a document"; no match with "Clear filter". |
| P-599 | ✓ | It was already the same. |
| P-600 | ✓ | A phone tap opens the viewer route (round 1), which now exists. |
| P-601 | ✓ | New routes: the three staff vaults now render from `vault/layout.tsx`, and `vault/view/[id]/page.tsx` claims the viewer path, so `<vault>/view/<id>` opens round 1's `DocViewerOverlay` over the explorer. Before this the viewer links went to a 404. |
| P-602 | ✓ | The Vault viewer is the full overlay (round 1). The doc-pack dialog is not mine and stays. |
| P-603 | ✓ | Toolbar: badge, name, meta, "N of M", Download, Close (Esc). |
| P-604 | ✓ | Previous and next: floating chevrons from md, a bar on phones, arrow keys. |
| P-605 | ◐ | Page and zoom pill for images; PDFs use the browser viewer's own controls. |
| P-606 | ✓ | No-preview card with Download. |
| P-607 | ✓ | It was already the same. |
| P-608 | ✓ | Round 1: `/app/{admin,manager,intern}/profile` render AccountSettings. Request: point `roleSettingsPath` and the avatar link at them (shell, `src/lib/auth-routes.ts`). |
| P-609 | ✓ | Round 1: no visible title (only an sr-only h1). Checked. |
| P-610 | ✓ | It was already the same. |
| P-611 | ✓ | Round 1, checked: About you, Sign-in and security, Notifications, Email, Appearance, and Settings for admin, manager and lead. |
| P-612 | ✓ | Round 1: one section at a time from `?tab=`, `?outlook=` or the hash (`sections.ts`, tested). |
| P-613 | ✓ | It was already the same. |
| P-614 | ✓ | Round 1: "Saved" chip after the profile saves. |
| P-615 | ✓ | It was already the same. |
| P-616 | ◐ | Round 1, checked: photo, full name, email, phone, WhatsApp chip and role, read view with "Edit". No designation or membership number (P-617). |
| P-617 | ✗ (stays) | Schema need: `profiles.designation text null` and `profiles.membership_no text null` (ICAI or ICSI number, shown in mono). Not added: no schema edits in this task. |
| P-618 | ◐ | "Password" row with "Change password". There is no Microsoft sign-in: Auth.js here signs in with email and password only (Outlook is a mail link, shown under Email). |
| P-619 | ✓ | Round 1: `PasswordStrength` bar under the new password. |
| P-620 | ◐ | Round 1, checked: two-step on and off with key, QR and code rows and plain toasts. No Undo: turning two-step back on needs a fresh code. |
| P-621 | ✓ | It was already the same. |
| P-622 | ◐ (real only) | Kept "Sign out · On this device". |
| P-623 | ◐ | Round 1, checked: Email and WhatsApp per row; in-app is always on. The app has no Teams channel. |
| P-624 | ✓ | Round 1, checked: each notifications row has a 28 px tinted tile (R-16). |
| P-625 | ✓ | It was already the same. |
| P-626 | ◐ | Weekly digest by email only. A daily digest time needs a stored preference and a job; neither exists. |
| P-627 | ✗ (stays) | No data: the app sends no escalation or "approvals waiting" alert, so a switch would control nothing. |
| P-628 | ✓ | It was already the same. |
| P-629 | ✓ | It was already the same. |
| P-630 | ✗ (shared) | Density is kept per grid (`readDensity(scope)` in `src/lib/ui/table-prefs.ts`, foundations). Request: a person-wide default density that grids fall back to, then the Appearance switch can set it. |
| P-631 | ✗ (shared) | Request (foundations): a text-size token on the root. Components use px sizes, so a page-level control would change nothing today. |
| P-632 | ◐ (real only) | Kept the greeting card and sidebar background pickers, Animations and Reduce motion. |
| P-633 | ✓ | It was already the same. |
| P-634 | ✓ | Round 1, checked: the Settings section holds the Profile, Security and Outlook cards for admin, manager and lead. |
| P-635 | ◐ | Profile saves show the "Saved" chip and toasts. No Undo on profile fields: the save route keeps no earlier value. |
| P-636 | ✓ | It was already the same. |
| P-637 | ✓ | It was already the same. |
| P-638 | ✓ | New `app/app/super/profile/page.tsx` renders AccountSettings with `?tab=`; `AccountSettings` uses `?section=` only inside Super › Settings now. Request (shell): point the super account row at `/app/super/profile`. |
| P-639 | ✗ (stays) | No data: there is no escalation or monthly partner report message to switch. |
| P-640 | ✓ | New `app/app/super/vault/{layout,page}.tsx`: the staff Vault for the super admin (the vault already names `/app/super/vault`, and every documents route admits super through `requireAnyRole('admin', ...)`). Request (shell): a Documents link in the super nav. |
| P-641 | ✓ | New `app/app/super/vault/view/[id]/page.tsx`: the viewer over the super Vault. |
| P-642 | ✓ | It was already the same. |
| P-643 | ✓ | It was already the same. |
| P-644 | ◐ (shared) | Shell file (`RoleSidebar.tsx`). Left to the shell agent. |
| P-645 | ◐ (shared) | `src/lib/ui/card-head-icon.ts` is foundations. Request: add due, reminder, thread, assign, capacity, access, session, key, deploy, job, cost, source, connection and integration. |

Round 3 (after commit 690832a) went through every row left over: Announcements, Notifications, Audit log, Knowledge bank, Vault preview, Profile and super reach. Each row above now says what was done or why it stays; "Round 1, checked" means I read the code against the prototype and found it done.

## Round 3: files changed

- `src/components/announcements/AnnouncementList.tsx`: the title leads the row, the body follows; no time in the by-line; the host tag from sm up and in the by-line on a phone.
- `src/views/announcements/AnnouncementDetailDialog.tsx` (new) and `__tests__/announcement-detail.test.tsx` (new): the detail modal with the title as heading, sender row, previous and next, "3 / 8", Open and "Got it".
- `src/views/announcements/AnnouncementsPage.tsx`: a row opens the detail modal (the live popup stays for new arrivals); L1 loading rows.
- `src/components/announcements/OfficialPortalsDirectory.tsx`: Landmark head tile.
- `src/views/admin/audit-log/audit-filters.test.ts` (new): areas, result words, change block, who filter.
- `src/views/knowledge-bank/KnowledgeBankPageSections.tsx`: identity-mid spine, L1 loading in both cards.
- `src/views/knowledge-bank/KnowledgeBankPage.tsx`: A1 toasts with Undo for upload and new folder (admins and managers).
- `src/views/vault/use-vault-actions.ts`: the review toast is the A1 toast.
- `src/views/settings/AccountSettings.tsx`: `?section=` only inside Super › Settings, `?tab=` elsewhere.
- `app/app/super/profile/page.tsx` (new), `app/app/super/vault/layout.tsx`, `page.tsx` and `view/[id]/page.tsx` (new).

New routes in round 3: `/app/super/profile`, `/app/super/vault`, `/app/super/vault/view/[id]`.

Schema need from round 3: `profiles.designation text null` and `profiles.membership_no text null` (P-617).

Requests added in round 3: the super nav needs a Documents link (`/app/super/vault`) and the account row should open `/app/super/profile` (shell); `file-badge.tsx` colours (P-559), a person-wide density default (P-630), a text-size token (P-631), the `EFilingGrid` range footer (P-541) and the card icon words (P-645) go to foundations.

Round 3 checks: `npx tsc --noEmit -p .` is clean for the whole project at the time of the run. `npx vitest run` on every folder near my files: 21 files, 114 tests pass. `npx eslint` on the round-3 files: 0 errors.

## Files changed (round 2)

- `app/api/dev/jobs/retry/route.ts`: `out.ok === false` narrows `RetryOutcome` (the typecheck error).
- `src/lib/dev/route-helpers.ts`: `devAction` writes a `dev.action.denied` audit row on 403.
- `src/lib/dev/route-helpers.test.ts` (new): 403 is denied and audited, 401 is not, body check, context passed.
- `src/lib/dev/dev-lib.test.ts`: `eventId` in the run shape, and `canRetryRun` cases.
- `src/components/dev/parts.tsx`: new `ChangeConfirm` (before and after, R-40).
- `src/views/dev/DevJobs.tsx`: Retry on failed runs, "Recent failures" card, Duration, Next run, sticky first column.
- `src/views/dev/DevDeploys.tsx`: "Redeploy" with ChangeConfirm.
- `src/views/dev/DevConnections.tsx`: Kind filter, `?c=` deep link, picked row tint, kind · provider, Outlook "Disconnect" with DangerConfirm.
- `src/views/dev/DevLogs.tsx`: Source filter, Source and Request ID columns and panel facts, picked row tint.
- `src/views/dev/DevAudit.tsx`: Actor, Action and Date filters, Clear all, Before and After columns.
- `src/views/dev/DevMessages.tsx`: status tab counts.
- `app/app/dev/page.tsx` (new): redirect to the overview.
- `app/app/{admin,manager,intern}/vault/layout.tsx` (new), `vault/page.tsx` (now render nothing), `vault/view/[id]/page.tsx` (new): the viewer route.
- `src/views/vault/DocumentVaultPage.tsx`: `tabIndex={-1}` on the tree (lint error).
- `src/views/knowledge-bank/KnowledgeReader.tsx` (new) and `app/app/{admin,manager,intern}/knowledge-bank/[id]/page.tsx` (new): the staff reader.
- `src/views/knowledge-bank/KnowledgeBankPageSections.tsx`: titles link to the reader; back chevron removed (R-09).

Round 1 files kept as they were (checked by typecheck, tests and spot reads): the dev routes, repositories and parsers, `DevOverview.tsx`, the Vault parts and `DocViewerOverlay.tsx`, Audit log, Notifications, Profile and all public files.

## New routes

- `/app/dev` (redirect).
- `/app/{admin,manager,intern}/vault/view/[id]`.
- `/app/{admin,manager,intern}/knowledge-bank/[id]`.
- From round 1, now used by the screens: `POST /api/dev/jobs/retry`, `POST /api/dev/deploys/redeploy`, `POST /api/dev/connections/outlook/disconnect`.

## Schema needs

None.

## Requests for shared files

- Shell (`RoleSidebar.tsx`, `TabBar.tsx`, `TopBar.tsx`): developer badges on Connections and Jobs (P-254); the developer items for the super admin inside `/app/dev` (P-255); phone tabs Overview, Jobs, Connections (P-256); no Notifications bell for the developer (P-257).
- `src/lib/auth-routes.ts`: point `roleSettingsPath` and the rail Profile link for admin, manager and intern at the new `/app/<role>/profile` routes (P-608).
- Guards: let the account and profile APIs admit the developer role, so `/app/dev/profile` can be built (P-258 to P-261).
- Foundations: let a `DashHero` stat take an `icon` (P-280).
- Round 1's public requests still stand: `NEXT_PUBLIC_DEMO_LOGINS` in `.env.example` and never in production; tokens `side-deep` and `shadow-signin`.

## Decisions

- Console writes stay limited to what the backend can really do: retry a failed run of a single-listener event, redeploy the current image, and disconnect an Outlook link. Rotate, roll back, run now, test send and pause stay out, because the app has no route or no IAM write access for them.
- Redeploy uses a change confirm (before and after); Disconnect uses the type-the-word confirm, because it removes stored tokens.
- A console write refused for role writes a `denied` audit row, so the Overview "Denied" tile and the Audit page see it.
- The Vault renders from a layout so the viewer path keeps the explorer mounted; the old `src/views/admin/Vault.tsx` re-export is no longer imported but was left in place.
- The staff reader shows the knowledge bank file itself, since the bank holds files, not written articles.

## Checks

- `npx tsc --noEmit -p .`: clean in my files. Errors remain only in other agents' files (client portal compliances and team, super insights test, staff compliances, and new missing modules `@/views/admin/managers/ManagersPage` and `@/views/manager/LeadPage`).
- `npx vitest run` on dev, vault, knowledge bank, audit log, notifications, settings, marketing and auth: 18 files and 104 tests pass.
- `npx eslint` on my files: 0 errors (warnings only).
