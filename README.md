# VCFO Suite

Compliance cockpit for Indian professional-services firms — end-to-end company
incorporation (GCC entities), from client questionnaire through MCA filings,
statutory registrations, and the recurring compliance calendar.

Re-platformed from SBC-Track onto the **AWS-target stack** — but it runs
entirely on your own machine. Same stack local and in the cloud; deploying to
AWS later is a config change, not a rewrite.

**Stack:** Next.js 16 · React 19 · TypeScript · Postgres (Drizzle) · Auth.js ·
S3 (MinIO locally) · Inngest · Resend · Tailwind/shadcn · Vitest/Playwright.

> ⚠️ This is a **scaffold generated without a network** — it is not yet verified
> to build. Open it in **Claude Code** and follow `CLAUDE.md` to finish and
> verify it phase by phase. `MIGRATION.md` maps every old file to its new home.

---

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Postgres + MinIO)

## Run it on your laptop

```bash
cp .env.example .env.local
# set AUTH_SECRET:  openssl rand -base64 32   (paste into .env.local)

npm install
npm run infra:up        # start Postgres + MinIO (S3) in Docker
npm run db:generate     # generate the first Drizzle migration from schema.ts
npm run db:migrate      # apply it to local Postgres
npm run db:seed         # demo manager / intern / client + a sample engagement
npm run dev             # http://localhost:3000
```

Demo logins (created by the seed — **change before real use**):

| Role | Email | Password |
|---|---|---|
| Manager | `manager@vcfo.local` | `manager123` |
| Project Lead | `intern@vcfo.local` | `intern123` |
| Client | `client@vcfo.local` | `client123` |

MinIO console (to see uploaded files): http://localhost:9001
(`vcfo_minio` / `vcfo_minio_local_dev`).

---

## Run it as an office server (10-person pilot over WiFi)

Put the app on your high-end desktop; everyone on the same WiFi opens it in a
browser. No AWS, nothing leaves the building.

1. On the server machine, complete the setup above. For day-to-day LAN testing
   with hot reload:
   ```bash
   npm run dev:lan          # next dev bound to 0.0.0.0:3000
   ```
   For a production-like pilot build:
   ```bash
   npm run build
   npm run start:lan        # next start -H 0.0.0.0 -p 3000
   ```
2. Find the server's LAN IP:
   - Windows: `ipconfig`  ·  macOS/Linux: `ipconfig getifaddr en0` / `ip addr`
   - e.g. `192.168.1.50`
3. Auth / email links — either leave `AUTH_URL` unset (`AUTH_TRUST_HOST=true`
   is already on) or point both at the LAN URL:
   ```
   AUTH_URL="http://192.168.1.50:3000"
   NEXT_PUBLIC_SITE_URL="http://192.168.1.50:3000"
   ```
   Restart the server after changing env. `next.config.mjs` already allow-lists
   private LAN ranges for `next dev` so phones can load JS (login fields, toggles).
4. Testers visit **`http://192.168.1.50:3000`** on the office WiFi.

Notes for the pilot:
- Allow port 3000 through the server's firewall.
- Keep Docker (Postgres + MinIO) running on the server — that's the database
  and file store. Data lives on that machine only.
- For real client data during the pilot, make sure the server machine is
  backed up (the Postgres Docker volume `vcfo-pgdata` is your database).

---

## Going to AWS later (Stage 2)

Because of the repository seam and dev/prod parity, this is a deployment task:
stand up RDS + S3 + App Runner (`infra/`), point the same env vars at them, run
`npm run db:migrate`. The app code doesn't change. See `infra/README.md`.

---

## Project layout

```
app/                     Next.js routes (UI shells LIFTed; API routes ported)
  api/_reference-supabase/  ← old routes kept as reference; delete after porting
src/
  data/                  LIFTed pure domain data (checklist, obligations)
  domain/                LIFTed pure logic (validation, docx, compliance math) + tests
  db/                    ►► the seam ◄◄  Drizzle client, schema, repositories
  auth/                  Auth.js config + role guards
  storage/               S3 / MinIO helper
  email/                 DB-backed email (single system)
  jobs/                  Inngest scheduled jobs (compliance)
  components/ views/ hooks/   LIFTed UI
infra/                   Terraform for AWS (Stage 2)
scripts/seed.ts          demo data
CLAUDE.md                build instructions for Claude Code
MIGRATION.md             old → new file map + RLS-as-spec
```
