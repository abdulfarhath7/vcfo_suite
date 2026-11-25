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

People outside SBC sign in to the real application (`app.sbctrack.in`) with shared demo logins.
There is no separate demo site or database: the demo people and companies live in the production
database next to real clients, flagged `is_demo` (migration `0072_demo_logins`, additive). Keeping
them apart is the job of `src/lib/demo-logins.ts`.

| Login | Role | Sees |
| --- | --- | --- |
| `lead@vcfosuite.com` | project lead | the three demo companies and the demo receivables sheet |
| `client@vcfosuite.com` | client | the client portal of Kaveri Analytics |

The password is `Demo@2026` (`DEMO_LOGIN_PASSWORD` overrides it at seed time).

**There is no demo admin or demo manager login, on purpose.** An admin reads firm-wide data in
dozens of repositories (metrics, people, receivables, audit, practice dashboards), and a manager
has firm-wide reads too (knowledge bank, email templates, unassigned leads). Confining them would
mean a filter in every one of those places, so instead the guard (`currentContext` in
`src/auth/guards.ts`) and the sign-in (`systemCheckSignInPassword`) refuse a demo profile whose
role is not `intern` or `client`. A lead and a client are already scoped to the engagements they
are assigned to, and every demo engagement is assigned only to demo people.
`manager@vcfosuite.com` exists as an inactive profile with no password, only to own the demo
companies and the receivables sheet. Turning it on would still not give it a session.

### What a demo login cannot do

Every refusal says "Not available on demo logins" (HTTP 403).

- Its own account: password, email, profile, photo, two-step sign-in, sign-in links, signing out
  other devices, notification preferences, the WhatsApp number (`noDemo(...)` on the
  `/api/account/*` and `/api/client/account*` routes, `assertNotDemo` in `profiles.ts`).
- User management: client team invites, adding or replacing a client on a project, creating,
  deleting or re-emailing anyone (`profiles.ts`, `client/team`, `engagements/[id]/clients*`).
- Integrations: Outlook connect, send and groups, SharePoint folder, Tally pairing and sync, Zoho
  sync, sheet email settings (`receivables/tally-sync.ts`, `zoho-sync.ts`, `sheets.ts`).
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

Real admins still see the demo companies; the admin project list labels them "Demo"
(`Engagement.isDemo`). They also count in firm-wide dashboards and KPIs.

### Commands

```bash
npm run db:migrate                        # applies 0072_demo_logins (additive)
npm run db:seed-demo-logins               # local
npm run db:seed-demo-logins:prod          # production, through the SSM tunnel (scripts/demo-prod.mjs --demo-logins)
npm run db:seed-demo-logins -- --reset    # also drop what visitors added on the demo companies
```

The seed only writes rows flagged `is_demo` or hanging off them, and stops before writing if a
real profile or project holds a demo email or slug. Rerunning rebuilds the seeded rows (documents,
tasks, filings, GST fields, activity, audit, budgets, the sheet's invoices) and keeps the ids.

State: incorporation fully done on all three companies (the 14 SPICe+ steps, certificate, PAN,
TAN, board resolution, post-incorporation); registrations half done (GST with GSTIN, LUT and MSME
done; PF and PT in progress; ESI and Shops & Establishment not started); Narmada Cloudworks has
GST ready to start, for the VCFO Assist demo; FY 2026-27 filings filed up to last month, a few of
this month's past due dates overdue, the rest upcoming. Kaveri Analytics carries a receivables
sheet (nine INR invoices, the lead as editor) and Kaveri and Tungabhadra carry draft budgets.
Identifiers are fake: PAN and TAN in the `ZZ` series, CIN registration numbers `9999xx`, GSTINs
built from those PANs with a valid check character, DINs `9991xxxx`.

### Tests

- `src/lib/demo-logins.test.ts`, `src/auth/guards-demo.test.ts`, `src/lib/email/send-email-demo.test.ts`,
  `src/lib/ask/rate-limit-demo.test.ts`: the rules, without a database.
- `src/db/repositories/demo-isolation.db.test.ts`: the cross-tenant suite against a real database
  with real-looking data (skipped unless `DEMO_ISOLATION_DB_URL` is set; the header lists the
  seed commands).

### Not covered

- Firm-wide reads a lead already had and that hold no client data: the statutory calendar,
  obligations, agenda library, announcements, Watch updates (public regulatory news), the
  firm settings read (firm name, support contact) and the Ask knowledge documents.
- Demo use counts against the firm's single daily AI token budget, and demo client questions
  appear in the admins' question-gap review.
- Jobs that email contacts typed on a demo company other than directors (for example a client
  contact) rely on those contacts being demo mailboxes; the client team and client invite routes
  are closed to demo logins, so no new contact can be added from a demo login.
