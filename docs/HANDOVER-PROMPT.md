# Paste this into the new Claude Code session

Copy everything between the lines below as your first message in the new
session. It is written to be pasted as-is.

---

You are taking over an existing, working product. Do not start from scratch.

**Project:** VCFO Suite — a compliance cockpit for an Indian CA firm (SBC). It
walks a client and the firm's staff through a 48-step company-incorporation
checklist (SPICe+ Part A/B, post-incorporation, registrations), generates the
legal .docx documents from the collected answers, enforces who may do what and
when, notifies by email and WhatsApp, and then runs a recurring statutory
compliance calendar. Live at https://app.sbctrack.in on AWS App Runner.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Postgres 16 +
Drizzle · Auth.js · S3 (MinIO locally) · Inngest · Resend/SES + MS Graph ·
Tailwind 3.4 + shadcn + Framer Motion · Vitest (~1,560 tests) + Playwright.
~1,135 TS/TSX files.

## 1. Read these first, in this order — before writing any code

1. `CLAUDE.md` — build instructions and the golden rules
2. `docs/KNOWLEDGE-TRANSFER.md` — the full A-to-Z handover (26 sections). This
   is the single best starting point; everything below is a summary of it.
3. `docs/context/STATE.md` — what is verified green right now, feature by feature
4. `docs/context/HANDOFF.md` — the last session's work, owner preferences, next steps
5. `docs/context/notes/` — 12 files of gotchas already paid for once. Read the
   one matching whatever you are about to touch.

Those files are the live source of truth. If they disagree with anything in
this message, they win.

## 2. My job for you

**Continue the new "orbit" UI.** It replaces the existing dashboards, starting
with the client portal. The code is already in the tree, untracked:

- `src/lib/orbit/` (9 files): `orbit-model.ts`, `orbit-geometry.ts`,
  `orbit-selectors.ts`, `orbit-palette.ts`, `orbit-area.ts`, `orbit-today.ts`
  plus their tests
- `src/components/client/orbit/` (17 files): `OrbitMap`, `PortfolioOrbit`,
  `AscentPath`, `DatesDeck/`, `DetailDrawer`, `DockPanel`, `StatusBrief`,
  `data/filing-flows.ts`, `data/step-rich.ts` plus their tests

**Read all 26 of those files and their tests before writing anything new**,
then continue from where they stop. The v7 client-portal redesign sitting
underneath them (modified `src/views/client/Overview.tsx`, `app/globals.css`,
`src/views/admin/FirmDashboard.tsx`) is the step before orbit and is still
under my review — do not undo it.

The `scratch-flows.json`, `scratch-flows.txt` and `scratch-rich.json` files at
the repo root are scratch output from that work, not product.

## 3. Hard rules — breaking these costs real money

1. **The seam is sacred.** Only `src/db/repositories/*` may import `db`. Views,
   components and API routes call repository functions. Never `import { db }`
   anywhere else. Exception: Inngest system jobs, which are named `system*`.
2. **Every repository takes `AuthContext` first and scopes by role.** Access
   control lives in the repository layer ("Path A"), not Postgres RLS. The
   matrix is in `src/db/repositories/README.md` and section 8 of the handover.
3. **Never add a route that returns the raw `checklist_state`.** Always go
   through `checklistStateForViewer(ctx, state)`.
4. **Don't touch the LIFTed domain code** (the checklist catalog, per-step
   validators, docx generation, compliance math) unless a test fails.
5. **Never hardcode an endpoint.** Everything flows through env vars.
6. **Do not commit or push unless I ask.** Much of the tree is intentionally
   uncommitted.
7. **Do not start a second `next dev`.** I run `npm run dev` on :3000 myself.
8. No Supabase, no Kubernetes, no Lambda-per-route, no second WhatsApp provider.

## 4. UI rules I have already given — do not regress them

- No dropdowns for phase steps — they open **in place, on screen**.
- Every opened view names where it goes back to ("Back to home", "Back to phases").
- Status colours: completed **green**, your turn **blue** (primary), with the
  team **amber**, upcoming **grey**.
- No content expanding beside a narrow column; no `overflow-hidden` clipping.
- `--ink` is a **surface** token — never `text-ink` for text. Use
  `text-foreground` / `text-muted-foreground`.
- Dark mode must stay readable (`.dark [data-role="client"]` overrides the
  pinned light surface).
- Floating buttons must not cover dashboard content.
- Primary is professional blue (#2563EB). Never orange, terracotta, peach, gold
  or beige. `--orange-*` / `--gold-*` are deprecated aliases of blue.
- Tailwind 3.4: opacity steps of 5 only.
- `LazyMotion` uses `domMax`; use `m.*` not `motion.*`; never put a CSS
  `transform` on a node hosting a `layoutId` pill.
- Keep as-is unless I ask: the compliance calendar page, `ClientTimeline`, the
  VCFO-by-SBC logo, Ask VCFO behaviour.

The goal: a professional, institutional CA/finance product a client understands
at a glance. Tight margins, no empty space, colour only where it identifies
something, every button works.

## 5. Run it

Docker Desktop must be running first, or login fails with `ECONNREFUSED`.

```
npm install
npm run infra:up        # Postgres + MinIO in Docker
npm run db:migrate
npm run db:seed
npm run dev             # http://localhost:3000
```

Demo logins: `super@vcfo.local`/`super123`, `admin@vcfo.local`/`admin123`,
`manager@vcfo.local`/`manager123`, `intern@vcfo.local`/`intern123` (this is
"Project Lead"), `client@vcfo.local`/`client123`.

Log in as each role and click around before changing anything.

## 6. The gate — run this before telling me something is done

```
npx tsc --noEmit -p .
npx vitest run --testTimeout=60000
npm run lint
```

Baseline to match: **0 typecheck errors, ~1,560 tests green, 0 lint errors**
(~171 warnings). Use `--testTimeout=60000` — the docx/zip/Ask tests exceed the
5s default while `next dev` is running.

I am on Windows / PowerShell: no `&&`, chain with `;`.

## 7. Two naming traps

- The code role `intern` means **"Project Lead"** in the product. The UI never
  says "intern".
- `app/app/{role}/**/page.tsx` files are **route shells only**. The real UI
  lives in `src/views/` and `src/components/`.

## 8. How I work

I test on localhost, logged in as the Routeware client, and send you
**screenshots** of what to change. My messages are short — read the screenshot
carefully. Explain things to me fully in clear English as you go; I want to
understand before the work happens, not after.

Start by reading `docs/KNOWLEDGE-TRANSFER.md`, then the orbit files, then tell
me what you found and what you propose to do next.

---
