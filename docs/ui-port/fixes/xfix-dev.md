# Developer console, round X (the ✗ rows)

Round X built the data paths the earlier rounds lacked. These are new: stored live checks (`dev_service_checks`), console switches (`dev_settings`), the images production has run (`dev_deploy_images`), and personal API tokens (`dev_api_tokens`, with read-only bearer support). The new AWS readers and writers go through packages already installed. Every write goes through `devAction` (it checks `requireDeveloper` and writes an audit row) and asks first with DangerConfirm or ChangeConfirm/InlineConfirm. A part whose env var is missing shows the "not set up" state. AWS is mocked in every test.

| No. | New status | What you did, or why it stays |
|---|---|---|
| P-256 | ✓ | `tabBarTabs('developer')` already returned Overview, Jobs and Connections. The follow-up changed the Jobs icon from `Clock` to `Terminal` in `TabBar.tsx` (one line, as the coordinator asked). Test: `src/components/shell/tab-bar-developer.test.ts`. |
| P-282 | ✓ | Services health now has "Uptime, 30 days" (amber below 99.5) and "p95" per service, plus Last check. The numbers come from the stored live checks: the new `service-checks` job checks every set-up service every 5 minutes as "System", and Test on Connections adds checks by hand. Uptime is the share of checks that passed, and p95 is the check's round trip. The app keeps no request metrics. |
| P-287 | ✓ | New "Incidents" card (Date; What happened as service · length; Status Open or Resolved; "Logs ›"). An incident is a run of failed checks, closed by the next passing check (`incidentsFrom`). |
| P-292 | ✓ | New "Environments" grid: Production, address, version (image tag), commit (when the tag is hex), deployed (App Runner `UpdatedAt`), and by (the last console redeploy or roll back from the audit log, or "Pipeline"). There is one row because staging does not exist. |
| P-298 | ✓ | Columns are now Account (the from address, bucket, app id, or tenant/phone ids cut to four characters), Last check (red when it failed) and Auth expires (Outlook's earliest token, amber within 15 days; "None" for the others), plus a Test action. |
| P-303 | ✓ | Scopes tags in the detail: the IAM actions or OAuth scopes the code uses for each service (`SERVICE_SCOPES`). |
| P-304 | ✗ (stays) | The account comes from the service env, and Terraform owns that env. An edit from the console would drift from Terraform and be undone on the next apply. |
| P-305 | ✗ (stays) | Provider keys (Resend, Inngest, Anthropic, Azure) are issued by the providers and kept in Secrets Manager. The app cannot mint them and has no Secrets Manager package. Rotation is built for the console's own API tokens (P-359). |
| P-306 | ✓ | Unchanged (round 2). |
| P-307 | ◐ | Per-service sections are built: summary facts (endpoint, account, last check, auth expiry, uptime, p95, set and missing env names, scopes), Test, the domain card, Used by, Send a test and Recent events. The settings rows are read-only, because Terraform owns the env. |
| P-308 | ✓ | `DomainCard` "Email domain <domain>": SPF and DMARC come from DNS. DKIM and the return path come from SES `GetEmailIdentity`, or from the Resend DNS names. "Verify" checks again. |
| P-309 | ✓ | "Used by" grid on Email and WhatsApp: Message, Template, Sent 7 days, Failed, built from the code's notify events and the delivery log. |
| P-310 | ✓ (email) | "Send a test" on Email sends one plain mail through the app's own email path and writes `dev.connection.test_send` with the address masked. WhatsApp has no test send: it can only send approved templates with variables, and none is a test template. |
| P-311 | ✓ | "Recent events": the last five checks plus console audit rows that name the service. |
| P-312 | ✗ (stays) | Services are connected through the env and Terraform, and Outlook from each person's profile. No connect route fits. |
| P-320 | ◐ | Delivery rows can be picked. The preview shows the Queued, Sent, Delivered, Read dots from the stored status, then Channel, To (masked), Queued, Last update, Status, Template and Error. Bodies, subjects and retries are not stored. |
| P-321 | ✗ (stays) | The message body and variables are not stored, so one message cannot be sent again. |
| P-322 | ◐ | "Message routes" grid: Message, Channel, Template, 7 days, Delivered %, Failed, and a channel filter. There is no Test or Edit, because routes are code (`NOTIFY_EVENTS`, template env names). |
| P-323 | ◐ | "Timing" card (read-only): deadline reminder days from firm settings, each job schedule (cron in words) and the time zone. It is not editable here: reminder days belong to the admin firm settings, and quiet hours are per person. |
| P-324 | ◐ | "Failed in 24 hours" card: counts by channel and error code. There is no "Retry failed" (see P-321). |
| P-325 | ✓ | The same `DomainCard`, beside the failed card. |
| P-326 | ✓ | "Templates" with WhatsApp and Email tabs. WhatsApp lists the templates on the linked business account (AWS End User Messaging `ListWhatsAppMessageTemplates`: name, language, category, status). Email lists the step mail templates (status, changed, last used, sent 7 days). There is no SMS tab and no body preview, because the app sends no SMS and Meta holds the bodies. |
| P-331 | ✓ | "Run now" per job, turned off while the job runs or jobs are paused. It sends `dev/run.<job id>` (`POST /api/dev/jobs/run`, audited `dev.job.run`). Every cron job now takes that event as a second trigger (`withRunNow` in `src/jobs/dev-controls.ts`). Event jobs have no Run now, because they need their event's data. |
| P-332 | ✓ | Pick a job (its last run) or a run to see "Run log": the status, start, duration and output from Inngest `GET /v1/runs/{id}`, then the app log lines that name the job, from CloudWatch, with time, level colour and mono text. Close button. |
| P-334 | ✓ | "Queue" card: Jobs, Running now (with names), Failed in 7 days, Runs in 7 days, Last run, Paused by. |
| P-335 | ✓ | The "Pause all jobs" SwitchRow asks "Pause all jobs? No reminder goes out until you resume." in place before turning on. It is stored in `dev_settings` (audited `dev.setting.change`). These jobs check it first, inside a step, and return `{ skipped: 'paused' }` while it is on: compliance-reminders, daily-digest, weekly-digest, saved-reports-send, staff-alerts and whatsapp-send. Note: a cron job simply runs again on its next schedule, but an alert or WhatsApp event that arrives while paused is dropped, not held. |
| P-343 | ◐ | "Keeping logs": the segmented "Keep logs for" 14, 30 or 90 days, with the stored size. A change asks with an inline ChangeConfirm (Now and After), then calls CloudWatch `PutRetentionPolicy` (`dev.logs.retention`). There is no "Errors to Teams" switch, because the app has no Teams sender. |
| P-348 | ✓ | "Earlier images" card: every image the console has seen production run (recorded on each Deploys read), with "Roll back" asking "Roll back production to X?" in place, then App Runner `UpdateService` with only the image changed (`dev.deploy.rollback`, before and after). With today's pipeline (`:latest` only) the list holds one image, so the card says "No earlier image yet". See requests. |
| P-349 | ◐ | History rows can be picked. The "Release" panel shows Commit, Deployed, Duration, Status, Image and Operation ID. App Runner does not say which image an operation rolled out, so only the newest operation names one. There are no release notes. |
| P-350 | ◐ | "Database migrations" grid: Migration, What it does, Status (Applied or Waiting) and date. It compares the journal in the code with `drizzle.__drizzle_migrations`. There is no "Run migrations" button: migrations run from the deploy runbook, and running DDL from the web app is not safe. |
| P-351 | ◐ | "Feature flags" grid built from the env switches (WhatsApp, Ask VCFO, SES, costs): flag and env name, Production, who sees it, On. There is no switch (Terraform owns the env) and no staging. |
| P-353 | ✓ | "Sign-in methods" StackedBar, "People, last 30 days": Password and code (navy) and Password only (blurple), from sessions started in 30 days and each person's two-step state. There is no third method because there is no SSO. |
| P-354 | ◐ | "Sign-in rules" (read-only): staff two-step "Not required" (each person turns it on) and session length 30 days. Enforcing a rule needs a change in `src/auth/config.ts`. |
| P-355 | ✗ (stays) | No console-wide settings exist apart from the ones built on their own pages (Pause all jobs, Keep logs for). |
| P-357 | ✓ | "Sessions signed in now": person (role), device, browser, address (first two parts only, because the app stores no place), since, active, and "Revoke" or a "You" tag. Revoke asks in place, signs that device out and writes `dev.session.revoke`. It refuses the caller's own device. Client sessions stay counted, not listed. |
| P-358 | ◐ | "Secrets and API keys" (meta "Values never shown"): each secret the app uses, with its scope, Stored in (Secrets Manager or App Runner env, read from App Runner's names, or this server), a masked value and Set or Missing. The new "API tokens" card lists personal tokens with created, expires, last used and status. Created and expiry dates for provider secrets are not known. |
| P-359 | ✓ | Rotate on an API token: DangerConfirm, type ROTATE, RotateCw icon. It makes a new token, shows it once, and keeps the old one working for 24 hours, then shows the "Key rotated" toast (`dev.token.rotate`). |
| P-360 | ◐ | Revoke a token uses the inline ChangeConfirm (Active, then Revoked). "Purge" for the seeded demo logins uses DangerConfirm (type PURGE): it turns every @vcfo.local account except the caller's to inactive and signs their devices out (`dev.demo.purge`). "Set" is not built, because Terraform owns the secrets. |
| P-363 | ✓ | "Service accounts": the App Runner instance role, the Inngest app, the Microsoft Entra app (id cut short) and the storage key, if one is set. Each row has Kind, Can (tags) and Last used (that service's last check). |
| P-365 | ◐ | "Database" card from Postgres: version, size, connections of max, running since, oldest vacuum and dead rows. There is no RDS backup facts or "Test a restore": no `@aws-sdk/client-rds`. |
| P-366 | ✓ | "Volumes" since the first of the month: emails and WhatsApp sent, documents added (with size), sign-ins and audit events. |
| P-369 | ✓ | "Cost over 6 months" bar chart (`DashBarChart`, brand bars), from Cost Explorer MONTHLY. Without `AWS_COST_EXPLORER=on` it shows "not set up". |
| P-370 | ✓ | "Storage by bucket" for `S3_BUCKET`: region, size, objects (counted up to 20,000, with "+" beyond), versioning chip and lifecycle rule count. |
| P-372 | ✗ (stays) | No RDS snapshot reader: `@aws-sdk/client-rds` is not installed, and the rules allow no new dependencies. |
| P-373 | ✗ (stays) | The app has no export feature to list. |

## Follow-ups (done after the first report, at the coordinator's request)

- **Run now:** every cron job (compliance-generate, announcement-feeds, compliance-reminders, saved-reports-send, weekly-digest, kpi-snapshots, daily-digest and service-checks) now has the trigger `[{ cron }, { event: 'dev/run.<id>' }]`.
- **Pause:** the reminder, digest, alert and mail jobs return early when `systemJobsPaused()` is true.
- **Scheduled checks:** the new `src/jobs/service-checks.ts` (cron `*/5 * * * *`, retries 0) runs the live probes and stores each check with the new system writer `systemRecordServiceCheck` (`checked_by` is null and reads as "System"). It is registered in `app/api/inngest/route.ts` and in `src/lib/dev/jobs-registry.ts`, which now lists all 11 functions. "Pause all jobs" does not stop it, because it sends nothing.
- **Jobs tab icon:** the developer's Jobs tab now uses the Terminal icon.
- **Tests:** `src/jobs/dev-controls.test.ts` (run-now triggers on every registered cron job; each paused job returns before any work; the checks job writes system rows and counts failures), a system-check case in `src/db/repositories/dev-x.test.ts`, and `src/components/shell/tab-bar-developer.test.ts`.

## Files changed

- `src/db/schema-firm.ts`: four new tables, appended.
- `src/auth/guards.ts`: new `requireDeveloperOrToken(request)`, appended. Nothing existing changed.
- `src/lib/dev/route-helpers.ts`: `devRoute` (GET) now uses `requireDeveloperOrToken`. `devAction` is unchanged and session-only.
- `src/lib/dev/aws.ts`: names of secrets and env vars, instance role and full image in `readAppRunner`, plus `rollBackTo`, `readLogRetention`, `setLogRetention`, `readCostsByMonth`, `readBucketStats` and `readWhatsAppTemplates`.
- `src/lib/dev/inngest.ts`: `readInngestRun`, `runJobNow`.
- `src/lib/dev/parse.ts`: `runNowEvent`; `describeFunctions` returns `runEvent`.
- `src/lib/dev/types.ts`: new shapes.
- `src/lib/dev/format.ts`: `commitOf`.
- New in `src/lib/dev/`: `checks.ts` (live probes), `health.ts`, `service-meta.ts`, `domain.ts`, `secrets.ts`, `flags.ts`, `message-routes.ts`.
- New repositories: `src/db/repositories/dev-checks.ts`, `dev-settings.ts`, `dev-deploys.ts` and `dev-tokens.ts`.
- Extended repositories: `dev-access.ts` (sessions, revoke, sign-in methods, demo purge, `maskIp`), `dev-messages.ts` (routes, failure causes, email templates, timing, template and updated time on rows) and `dev-data.ts` (facts, volumes).
- Views: all of `src/views/dev/{DevOverview,DevConnections,DevMessages,DevJobs,DevLogs,DevDeploys,DevAccess,DevData}.tsx`.
- Components: `src/components/dev/parts.tsx` (SettingRow, SwitchRow, more error words), new `DomainCard.tsx` and `ApiTokensCard.tsx`.
- Routes: `app/api/dev/{connections,jobs,deploys,access,data,overview}/route.ts` were extended.
- Follow-ups: `src/jobs/{compliance-generate,announcement-feeds,compliance-reminders,saved-reports-send,weekly-digest,kpi-snapshots,daily-digest,staff-alerts,whatsapp-send}.ts`, the new `src/jobs/dev-controls.ts` and `src/jobs/service-checks.ts`, `app/api/inngest/route.ts`, `src/lib/dev/jobs-registry.ts`, `src/components/shell/TabBar.tsx`, and `systemRecordServiceCheck` in `src/db/repositories/dev-checks.ts`.
- Tests: new `src/lib/dev/dev-lib-x.test.ts`, `src/lib/dev/dev-aws-x.test.ts` (AWS SDKs mocked), `src/db/repositories/dev-x.test.ts` and `src/db/repositories/dev-tokens.test.ts`. Updated `src/lib/dev/dev-lib.test.ts` (`runEvent`) and `src/lib/dev/route-helpers.test.ts` (guard mock).

## New routes

- `POST /api/dev/connections/check`
- `GET /api/dev/connections/detail`
- `POST /api/dev/connections/test-send`
- `GET /api/dev/messages/setup`
- `POST /api/dev/jobs/run`
- `POST /api/dev/jobs/pause`
- `GET /api/dev/jobs/run-detail`
- `GET` and `POST /api/dev/logs/retention`
- `POST /api/dev/deploys/rollback`
- `POST /api/dev/access/revoke`
- `POST /api/dev/access/purge-demo`
- `POST /api/dev/access/tokens`
- `POST /api/dev/access/tokens/revoke`
- `POST /api/dev/access/tokens/rotate`

## Schema added (for migration 0029)

- `dev_service_checks`: id uuid pk; service text; ok boolean; latency_ms integer; detail text null; checked_by uuid null → profiles (set null); checked_at timestamptz default now. Index `(service, checked_at)`.
- `dev_settings`: key text pk; value jsonb default '{}'; updated_by uuid null → profiles (set null); updated_at timestamptz default now.
- `dev_deploy_images`: image text pk; first_seen_at timestamptz default now; last_seen_at timestamptz default now.
- `dev_api_tokens`: id uuid pk; name text; token_hash text (unique index `dev_api_tokens_hash_uq`); prefix text; created_by uuid → profiles (cascade); created_at timestamptz default now; expires_at timestamptz; last_used_at timestamptz null; revoked_at timestamptz null.

## Changes in src/auth (exactly)

`src/auth/guards.ts` gains one exported function, `requireDeveloperOrToken(request)`:

1. It calls `requireDeveloper()` first. A signed-in developer, or a 403, returns as before.
2. Only on a 401 does it read `Authorization: Bearer <token>`.
3. It looks up the token through `systemResolveDevToken`, which compares a SHA-256 hash, needs `vcfo_dev_` at the start, skips revoked or expired tokens, and requires the maker to be active and still a developer or super admin. It also writes `last_used_at`.
4. It returns the maker's AuthContext.

Only `devRoute` (the console's GET routes) calls it, so a token can read the console and nothing else. Every write (`devAction`) and every other guard stays session-only. Making, rotating and revoking tokens is audited (`dev.token.create|rotate|revoke`). Reads by token are not audited row by row; `last_used_at` records them.

## Env vars

None new. The readers use names already in `.env.example`: `APP_LOG_GROUP`, `APP_RUNNER_SERVICE_ARN`, `AWS_COST_EXPLORER`, `S3_*`, `EUM_PHONE_NUMBER_ID`, `SOCIAL_MESSAGING_REGION`, `SES_REGION` and `INNGEST_*`.

These IAM permissions must be added to the App Runner instance role:

- `logs:DescribeLogGroups` and `logs:PutRetentionPolicy`
- `apprunner:UpdateService`
- `s3:GetBucketVersioning`, `s3:GetLifecycleConfiguration` and `s3:GetBucketLocation`
- `ses:GetAccount` and `ses:GetEmailIdentity`
- `social-messaging:GetLinkedWhatsAppBusinessAccountPhoneNumber` and `social-messaging:ListWhatsAppMessageTemplates`

## Requests

- **Deploy pipeline:** also push each image with an immutable tag, such as the git short SHA (`:<sha>`), and deploy that tag. Then "Earlier images" fills, "Roll back" has targets, and Commit shows. Note: a roll back changes the image in App Runner outside Terraform, so the next `terraform apply` returns the service to `var.image_tag`.

## Decisions

- Uptime and p95 are measured from the app's own live checks, not request metrics, because `@aws-sdk/client-cloudwatch` (metrics) is not installed. The "how" text and the meta say "last 30 days" on the stored checks.
- Account edits, provider-key rotation, Set, connect and flag switches are not built. Terraform owns the service env and secrets, so console writes would drift and be undone.
- Demo purge sets accounts inactive and does not delete them, and it never touches the caller's own account.
- API tokens are read-only on purpose. The rotate grace period is 24 hours, as in the prototype.
- The Outlook "Test" asks Microsoft for an app-only token with the client credentials and throws it away. It is the only way to prove the secret works without a user.

## Checks

- `npx tsc --noEmit -p .`: clean.
- `npx vitest run src/jobs src/db/repositories/dev- src/lib/dev src/auth src/components/shell/tab-bar-developer.test.ts`: 121 tests pass.
- `npx eslint` on every file I changed: 0 errors, 4 warnings. Three are the old `react-refresh` warnings in `parts.tsx`; the fourth is the old one in `TabBar.tsx` (it exports `tabBarTabs` beside the component).
