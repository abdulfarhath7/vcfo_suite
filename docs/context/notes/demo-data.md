# Demo data for a live walkthrough

Two sets of demo data exist and they do not overlap.

| | `npm run db:seed-demo` | `npm run demo:seed` |
| --- | --- | --- |
| Purpose | fill a dev database so every screen has something | a named client story to walk a prospect through |
| Projects | ten invented companies | the six the owner demos |
| Profile tag | `@demo.vcfo.local` | `@demo.sbctrack.in` |
| Slug tag | `demo-` | `sbcdemo-` |
| Storage tag | `demo/` | `sbcdemo/` |
| Safe on production | no (it writes firm-wide rows and calls the firm-wide compliance generator) | yes |

Because the tags differ, one never deletes the other. `npm run db:purge-demo` is the
blunt instrument and still removes both, along with everything else that is not a
`@vcfo.local` seed login.

## The walkthrough set

`scripts/seed-demo-clients.ts` creates six projects, one per state worth showing:

| Project | Stage (DB → label) | What it shows |
| --- | --- | --- |
| Emburse India | `Pre-Incorporation` → Incorporation | SPICe+ in flight; the live step sits in review |
| Emburse WebPT India | `Operational Readiness` → Compliance | incorporation and all 48 steps closed |
| Emburse Buntera India | `Post-Incorporation` → Registration | post-incorporation work in progress |
| Rootware Labs India | `Post-Incorporation` → Registration | SPICe+ and post-incorporation done, registrations next |
| XYZ Ventures India | `Post-Incorporation` → Registration | incorporated elsewhere, SBC picked it up at registration |
| ABC Industries India | `Operational Readiness` → Compliance | incorporation and registrations done elsewhere |

Emburse is one client organisation holding three projects, so the Emburse login
demonstrates the multi-project client portal. Rootware, XYZ and ABC are their own clients.

### How "somebody else did this" is represented

A step another firm handled is stored `status: 'not-applicable'` with a note, the same
shape `createEngagementWithClient` already writes for a standalone company's board
resolution steps. `isChecklistStepSequentiallyComplete` treats `not-applicable` as
complete, so the sequential gate flows past those steps and opens exactly the live one.
The certificate of incorporation step stays `completed` even for those projects, so the
CIN, PAN and TAN still show on the overview.

## Commands

```bash
npm run demo:seed          # local database, from .env.local
npm run demo:clean
npm run demo:seed:prod     # production RDS, through an SSM tunnel this opens itself
npm run demo:clean:prod
```

Seeding clears its own tagged rows first, so it is idempotent — run it as often as you like.

## Why the production commands work the way they do

Production RDS is private and has no `DATABASE_URL`, so nothing on a laptop can reach it
without the SSM port forward on the NAT instance (`docs/context/AWS-DEPLOY.md`).
`scripts/db-env-prod.mjs` prints those two steps to run by hand. `scripts/demo-prod.mjs`
does them for you: it asks AWS for the RDS endpoint, its managed master secret and the NAT
instance, reads the App Runner service's own `S3_BUCKET` and `S3_REGION` so placeholder
PDFs land in the bucket the app actually reads, opens the forward, runs the seed through
it and closes the forward afterwards. No password is printed or stored; the seed reads the
rotating RDS secret itself when it connects.

Going through the database rather than the public API was the deliberate choice. There is
no bulk-import endpoint, and driving ~35 route handlers in sequence would need a signed-in
session, would be gated by the same sequential checklist the demo is meant to show
already finished, and could not set a `completed_on` date in the past.

### Needs on the machine that runs it

- AWS CLI with credentials for the account that holds the deployment, and the
  Session Manager plugin (`aws ssm start-session` fails without it).
- Nothing else. `certs/rds-global-bundle.pem` is in the repository.

## Gotchas

- `DEMO_PASSWORD` overrides the shared password (`SbcDemo@2026` by default). The accounts
  are real logins on a real deployment, so change it before a demo that anyone watches.
- Compliance filings are generated with the pure `generateComplianceInstances`, expanded
  only for these six engagements. `systemGenerateComplianceInstances` is deliberately not
  called: it is firm-wide and would touch real clients' calendars.
- `compliance_obligations` rows are inserted `onConflictDoNothing` and are **not** removed
  on cleanup. They are the static library in `src/lib/compliance/obligations-seed.ts`, not
  demo data, and the app needs them.
- If storage is unreachable the database seed still finishes and warns; document rows then
  point at objects that are not there, and the Documents pages will say so.
- Credentials vault rows are not seeded. `CREDENTIALS_ENCRYPTION_KEY` is not set on App
  Runner yet, so anything encrypted from a laptop could not be read back by the app.

## Resetting to a fresh tool (before real clients)

`scripts/reset-client-data.ts` removes everything typed in while testing: every project
(company, parent and subsidiary details, directors, checklist answers, documents, board
resolutions and meetings, compliance calendars, tasks, notes, messages, budgets, notices),
every `client` login, the demo logins (`@demo.vcfo.local`, `@demo.sbctrack.in`, staff ones
included), prospects, client invites, notifications, the reminder log, the failed-email
outbox, exports and KPI snapshots, and the project files in S3 (keys naming a deleted project
or login; the knowledge bank is never touched). It keeps staff logins, firm settings,
templates, the obligation and activity libraries, announcements, the knowledge bank,
receivables, website demo requests and the audit log of staff actions. It refuses to run if
no admin or super admin would be left.

```bash
npm run clients:reset                     # local, counts only
npm run clients:reset -- --yes            # local, deletes
npm run clients:reset:prod                # production, counts only
npm run clients:reset:prod -- --yes       # production, RDS snapshot first, then deletes
```

The `@vcfo.local` seed staff logins survive the reset; change their passwords or remove them
once real staff accounts exist.

## Demo logins (shared, on the real application)

People outside SBC sign in to the real application (`app.sbctrack.in`, the same URL and login
page) with shared demo logins. Since PLAN H2 (26 Nov 2026) the demo world is **its own database**
on the same Postgres server: `DEMO_DB_NAME`, default `vcfo_demo`. The main database holds no demo
rows (run `npm run db:remove-demo-from-main` once to take out the PLAN H copies).

| Login | Role | Sees |
| --- | --- | --- |
| `admin@vcfosuite.com` | firm admin | the whole demo firm (three companies, the demo people, the receivables sheet) |
| `manager@vcfosuite.com` | project manager | the three demo companies it manages, owner of the receivables sheet |
| `lead@vcfosuite.com` | project lead | the three demo companies and the demo receivables sheet (editor) |
| `client@vcfosuite.com` | client | the client portal of Kaveri Analytics |

The password is set at seed time: see `DEMO_LOGIN_PASSWORD` (the seed falls back to its own
default when it is unset). Do not write the password in docs; the repository is public.

### How the isolation works

- **One choke point.** `src/db/client.ts` exports the same `db`, but its pool is a `ScopedPool`
  that hands every query and every `connect()` to the main pool or the demo pool, chosen per call
  by `isDemoScope()` (`src/db/demo-scope.ts`). A transaction takes one connection from one pool,
  so it never mixes the two. The demo pool uses the same host, user, rotating secret and TLS, and
  is made on first use. No repository changed.
- **The scope.** `isDemoScope()` is true inside `runInDemo(fn)`, false inside `runInMain(fn)`,
  and otherwise follows the current Next.js request: a request whose Auth.js session cookie holds
  a token with `demo: true` is a demo request from its first query to its last (route handlers,
  server components, server actions, `after()` work). The token is decoded once per request, so
  nothing has to "enter" the scope and no query can reach the main database first. Scripts, cron
  jobs and signed-out pages use the main database.
- **Sign-in.** `authorizeCredentials` (`src/auth/config.ts`) checks an `@vcfosuite.com` email only
  in the demo database (`runInDemo`) and any other email only in the main one (`runInMain`),
  whatever cookie the browser still holds; the two-step pre-check does the same. A demo sign-in
  puts `demo: true` in the JWT and the session. A row whose `is_demo` does not match the database
  it was found in is refused. Microsoft sign-in always runs on the main database and refuses a
  demo email.
- **Every request.** The JWT refresh in `config.ts` and `currentContext` in `src/auth/guards.ts`
  refuse when the session says demo but the scope does not (or the reverse), when the profile
  row's `is_demo` disagrees with the session, and when demo logins are switched off. Every role
  is admitted: firm-wide for a demo admin means the demo firm.
- **Switched off.** `DEMO_DB_NAME=off` (or empty) refuses demo sign-in, signs out demo sessions,
  and makes any demo query throw instead of falling back to the main database.
- **Jobs.** The Inngest client middleware (`src/jobs/client.ts`) adds `demo: true` to every event
  sent inside a demo scope. `/api/inngest` (`src/jobs/demo-route.ts`) runs a step whose event
  carries it inside `runInDemo`; a demo event that reaches a job outside the scope is refused
  before the body runs. Inline fallbacks run inside the request, so they follow it. Cron jobs
  run for the main database only; there is no demo pass (reminders and digests for demo people
  would be dropped as outbound mail anyway).
- **Files.** `src/storage/s3.ts` adds the prefix `demo/` to every key inside a demo scope (put,
  get, head, signed URL, delete, list; list hands keys back without it). Stored paths stay
  unprefixed. A demo login cannot read a real object even with a real path.
- **Ask VCFO.** Token budget, rate limits and history are rows in whichever database the request
  uses, so the demo world has its own daily budget; the tighter demo cap still applies.
- **Second fence.** Seeded rows stay flagged `is_demo`, and a demo AuthContext carries
  `demo: true`, so the PLAN H refusals below still apply to every demo role.

### What a demo login cannot do

Every refusal says "Not available on demo logins" (HTTP 403).

- Its own account: password, email, profile, photo, two-step sign-in, sign-in links, signing out
  other devices, notification preferences, the WhatsApp number (`noDemo(...)` on the
  `/api/account/*` and `/api/client/account*` routes, `assertNotDemo` in `profiles.ts`).
- User management, so the shared logins stay stable: client team invites, adding or replacing a
  client on a project, creating, deleting or re-emailing anyone, welcome emails, reporting lines
  and developer accounts (`profiles.ts`, `client/team`, `engagements/[id]/clients*`,
  `admin/people/reporting`, `admin/people/developers`, `send-welcome-email`, `resend-welcome-email`).
- Integrations: Outlook connect, send and groups, SharePoint folder, Tally pairing and sync, Zoho
  connect, discover, links and sync, sheet email settings (`receivables/tally-sync.ts`,
  `zoho-sync.ts`, `sheets.ts`, `app/api/integrations/zoho/*`).
- Firm-wide data and writes: the knowledge bank, email templates, shared mail groups, labour
  register verdicts and code rules, Watch intake, escalations to admins, Assist recipe patches,
  progress CC lists, firm settings and logo, exports.
- Tasks go to the demo person only; directors on a demo company take only `@vcfosuite.com` emails
  (board notices are mailed from jobs outside the request).
- Ask VCFO: a tighter cap (`ASK_DEMO_RATE_LIMIT_HOUR`, default 10; `ASK_DEMO_RATE_LIMIT_DAY`,
  default 40 model answers per demo account, shared by every visitor) and no use of the firm's
  shared answer cache. Retrieval goes through the same scoped repositories, so only demo
  engagements reach the model.

### Outbound messages

`sendEmailNoLog` logs and drops any mail that names an `@vcfosuite.com` address (to, cc, reply-to,
from) or that started inside a demo person's request (`src/lib/demo-request.ts` marks the request).
WhatsApp (`sendWhatsAppTemplate`, DoubleTick) is dropped inside a demo request. For a demo
engagement, `resolveEngagementRecipients` and `firmAdmins` count only demo admins (none), and the
progress CC keeps only demo mailboxes, so real admins get no bell or CC about demo companies.

### Real staff

Real staff never see the demo companies: they live in the other database. The admin project list
still labels an `is_demo` row "Demo", which now only shows inside the demo world.

### Commands

```bash
npm run db:migrate-demo                      # create vcfo_demo if missing, apply every migration
npm run db:seed-demo-logins                  # create + migrate + seed the demo database (local)
npm run db:seed-demo-logins -- --reset       # also drop what visitors added on the demo companies
npm run db:remove-demo-from-main             # dry run: counts of is_demo rows in the MAIN database
npm run db:remove-demo-from-main -- --yes    # delete them (one transaction)
# production, through the SSM tunnel (scripts/demo-prod.mjs):
npm run db:migrate-demo:prod
npm run db:seed-demo-logins:prod
npm run db:remove-demo-from-main:prod        # add -- --yes to delete; takes an RDS snapshot first
```

The seed writes only to the demo database (it refuses when `DEMO_DB_NAME` names the main one),
creates it from `template0` when it is missing, and runs the migrations first. It writes the demo
firm settings, the four logins plus two inactive client contacts, the three companies, documents
(placeholder PDFs under `demo/`), tasks, filings, GST fields, activity, budgets and the receivables
sheet. Rerunning rebuilds the seeded rows and keeps the ids. Every deploy that adds a migration
runs `db:migrate-demo` after `db:migrate`.

The cleanup deletes only `is_demo` engagements, the receivables sheets owned by `is_demo`
profiles, and `is_demo` profiles, with their child rows: CASCADE and SET NULL keys are left to
Postgres; a NO ACTION key is set to null when the column allows it and the row is deleted when it
does not. A non-demo profile on the demo domain is reported and never touched.

State: incorporation fully done on all three companies (the 14 SPICe+ steps, certificate, PAN,
TAN, board resolution, post-incorporation); registrations half done (GST with GSTIN, LUT and MSME
done; PF and PT in progress; ESI and Shops & Establishment not started); Narmada Cloudworks has
GST ready to start, for the VCFO Assist demo; FY 2026-27 filings filed up to last month, a few of
this month's past due dates overdue, the rest upcoming. Kaveri Analytics carries a receivables
sheet (nine INR invoices, the lead as editor) and Kaveri and Tungabhadra carry draft budgets.
Identifiers are fake: PAN and TAN in the `ZZ` series, CIN registration numbers `9999xx`, GSTINs
built from those PANs with a valid check character, DINs `9991xxxx`.

### Tests

- `src/db/demo-scope.test.ts`: routing (inside and outside `runInDemo`, nesting, timers,
  transactions, concurrent scopes, lazy builders), the request scope from a real encoded session
  cookie (demo, real, forged, secure name), and `DEMO_DB_NAME=off`.
- `src/auth/sign-in-demo.test.ts`: sign-in routing by email domain for every role.
- `src/auth/guards-demo.test.ts`: the guard's fail-closed checks.
- `src/jobs/demo-scope-jobs.test.ts`: event tagging, the Inngest route scope, the backstop, and
  the S3 `demo/` prefix.
- `src/lib/email/send-email-demo.test.ts`, `src/lib/ask/rate-limit-demo.test.ts`,
  `src/lib/demo-logins.test.ts`: the outbound and Ask rules.
- `src/db/repositories/demo-isolation.db.test.ts`: the PLAN H cross-tenant suite (skipped unless
  `DEMO_ISOLATION_DB_URL` is set).

### Not covered

- Cron jobs have no demo pass (see Jobs above).
- Public links made inside the demo world (a receivables share link, a set-password link) are
  looked up in the main database when someone opens them signed out, so they do not work. That
  fails closed.
- Old demo placeholder objects written by PLAN H at unprefixed keys (`.../vcfodemo/...`) stay in
  the bucket; they hold only placeholder PDFs.
