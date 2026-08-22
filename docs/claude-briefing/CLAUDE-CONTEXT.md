# VCFO Suite — master context for Claude (paste this first)

Snapshot: 2026-08-20. For deeper files see `docs/claude-briefing/README.md`.

You are advising the **product owner** on **features, information architecture, and a full visual redesign**. Prefer decisions and trade-offs over code. When you recommend implementation, name files. Separate **safe visual change** from **do not break** workflows.

---

## 1. What this product is

**VCFO Suite** is a multi-role web cockpit for Indian professional-services firms (CA / CS / VCFO) that set up **GCC (Global Capability Centre) companies in India**.

One **engagement** = one company project. The firm walks the client through a **gated ~34-step incorporation checklist** (MCA SPICe+ name + incorporation, board resolution, post-incorporation, statutory registrations, FEMA), then a **recurring compliance calendar**. Leads still file on MCA/GST/RBI portals; this app collects, sequences, reviews, generates Word docs, stores files, emails, and audits.

**Not:** generic PM (Asana), MCA robot, multi-firm SaaS tenancy, or a chat product.

Origin: re-platformed from **SBC-Track** (Supabase) → Postgres + Drizzle + Auth.js + S3/MinIO. ~80% domain/UI lifted. Access control is in **repositories**, not RLS. Local Docker = future AWS shape (RDS + S3 + App Runner). Pilot: ~10 people on office WiFi.

Positioning today: “GCC compliance cockpit — engagements that feel precise, from intake to filing.”

Demo logins (seed):  
`super@vcfo.local` / `super123` · `admin@vcfo.local` / `admin123` · `manager@vcfo.local` / `manager123` · `intern@vcfo.local` / `intern123` · `client@vcfo.local` / `client123`

Code role **`intern`** = UI label **Project Lead**. Never show “intern” to users.

---

## 2. Five roles

| Role | Label | Home | Sees |
|---|---|---|---|
| `super_admin` | Super Admin | `/app/super/dashboard` | May enter every `/app/*` shell. Gold **badge** only, not a gold theme. |
| `admin` | Admin | `/app/admin/dashboard` | Firm-wide. Assigns PM on create. People, all projects, approvals, vault, KB, analytics, audit. |
| `manager` | Project Manager | `/app/manager/dashboard` | Owned engagements (+ `engagement_managers`). Approvals, leads who report to them, mail. Create project as self. |
| `intern` | Project Lead | `/app/intern/today` | Assigned engagements. Today queue, clients, step workspace. KB read-all + own upload. **No sequential lock on nav.** Spec: no audit read. |
| `client` | Client | `/app/client/inbox` | Own engagement(s). Gated catalog. Invite/substitute teammates. Shared docs only. **No BR drafts** until finalized. No KB. |

Admin and manager **share views** via `/app/admin/*` vs `/app/manager/*` (`useStaffBasePath`). Intern and client are **different products** (density + gating).

Org: Super → Admin → Managers → Leads (`reports_to_manager_id`). Many clients, leads, managers per engagement.

---

## 3. Core workflow (do not casually redesign the semantics)

**Create project** (admin/PM form, not the legacy OnboardingWizard): company, domestic/foreign, legal form, parent/subsidiary if starting late, client email + temp password, leads, managers, stage. Welcome email.

**Sequential gate (client):** step N opens only when previous **active catalog** item is terminal (`completed` / `not-applicable` / submit / deliver). **Draft save does not unlock.** Reject/unlock re-locks later steps. Copy: “This opens after {title} is complete.” Never “access denied.” Overdue badge only on current step.

**Intern:** can open any step. Autosave ~600ms `{ responses }` only — **must not email**. Request manager approval / Submit / Email manager again → managers only. Manager Accept → Outlook compose **to client**, CC admin + lead. Client submit/upload → Resend to lead + managers From `{company}@sbctrack.in` (Reply-To = client). First **Deliver** opens Graph compose; re-deliver is in-app toast + bell only.

**Board resolution (Pre-2):** generate from Pre-1 → intern editor → **finalize** is the only release (status `finalized`, unlocks Pre-3 signed upload, notify). Re-send compose does not duplicate in-app rows.

Email: one dispatcher (`send-email.ts`). Staff compose `/app/{role}/mail` via Microsoft Graph (connect mailbox; not Auth.js). Resend without keys = console skip. Forgot-password email not built.

---

## 4. The 34-step catalog (look may change; inventory should not be invented)

Source: `src/data/checklist.ts`. Intern phase titles: SPICe+ Part A / Part B / Post-incorporation / Registration (FEMA nested).

**Part A — Name (client/lead):**  
1 Client Details (client) → 2 Draft Board Resolution (lead, finalize) → 3 Signed BR (client) → 4 Name Application (lead) → 5 Name Approval (lead)

**Part B — Incorporation:**  
6 Director KYC (client) → 7 KYC Review & DSC (lead, DIR-2/8/INC-9 generate) → 8 Document Execution (client) → 9 SPICe+ Confirmation (client) → 10 SPICe+ Filing (lead) → 11 MCA Remarks (lead) → 12 Certificate of Incorporation (lead)

**Post-inc (lead, 11):** First Board Meeting, Letterhead, Bank, Share capital, SH-1, INC-20A, ADT-1, FC-GPR, Nominee MGT-4/5/6, INC-22, Name board.

**Registration (lead, 23 active):** intern groups General / Customs / Foreign Trade / Labour / Local Compliance / IP/Brand / FEMA (PF, GST, ESI, IEC, LUT, POSH, trademark, FLA, FCTRS, …). `reg-2` PAN/TAN is legacy, not in the active phase list.

Also: compliance calendar (separate from checklist; Inngest generate; digest email not fully wired). Stage `Operational Readiness` exists in DB but is **filtered out of primary UX**.

---

## 5. Screens / IA

**Chrome:** flush L-shell (sidebar + top bar, no floating inset). Top bar = wordmark (when rail collapsed) + Search (opens ⌘K) + theme + bell + avatar. No titles/breadcrumbs in the bar. Back chevron beside page H1 on nested routes. Sidebar Keep open / Keep closed / auto hover-peek. Intern: auto-expand on Clients list, stay collapsed on engagement workspace. `data-role` on body.

**Public:** `/` landing, `/roles`, `/contact`, `/login`, `/invite/[token]`.

**Intern nav:** Today (week queue **by company**, IST clock, tick+title rows; no Tasks — that URL redirects here) · Clients (nested companies) · Send email · Requests · Compliance · KB · Analytics · Audit.

Intern overview: company H1 + CC chips; **four phase rows** with tick tracks (not a 4-column stepper). Step page: H1 full width, form + **phase-scoped** journey rail on the right, sticky footer actions, underline section tabs, last tab = Submit. Hide working-days SLA and status chips.

**Client nav:** Inbox (requests + rejected resubmits, Due today / This week / Later) · Incorporation (**this is progress**; `/progress` redirects here) · Compliances · Documents · Team · Activity audit. Messages = **dead redirect**.

**Admin nav:** Home · Projects · People · Send email · Approvals · Compliance · Doc vault · KB · Analytics · Audit. Manager adds Project leads; same screens under `/app/manager`.

**Super:** launcher + pulse KPIs into firm/client shells.

---

## 6. Current visual system (what you are replacing)

**Brand:** cool professional blue `#2563EB` / hover `#1D4ED8`, 60% cool slate (never beige), 30% blue CTAs, 10% semantic chips. White text on primary. Dark mode = same family, not brown.

**Tokens:** OKLCH in `app/globals.css`. Tailwind maps them. **`--orange-*` and `--gold-*` already alias blue.** `GoldButton` is blue. Do not assume terracotta brand.

**Phase washes** (chips only, low chroma): Part A sky, Part B teal, post teal-green, FEMA indigo, registration violet-blue. Status: teal done · muted gold waiting · slate lock · rose error. Super: tiny gold chip.

**Type:** Manrope UI · Space Grotesk display (`font-serif`) · IBM Plex Mono. Radius `0.875rem`.

**Kits:** shadcn/ui + `src/components/noir/*` (`Surface`, `AccentButton`, illustrated empty states). JourneyNode (blue pulse, teal check, amber clock, slate lock). Motion: Framer `layoutId` pills; `LazyMotion` must stay `domMax`. Marketing: aurora, grain, product plane.

**Sprawl to fix in a rebrand:** 4 KPI components, 10+ status pills, dual toasts, mixed empty states, raw `slate-*`/`bg-white` on OnboardingWizard, analytics **hardcoded demo series**, People page showing generated ids, full-screen “Opening VCFO Suite…” boot screen, marketing seed stats.

**Least-risk restyle path:** tokens → fonts → logo → `Surface`/buttons/shell/JourneyNode → marketing/login → hunt raw palette classes. Changing `--primary` recolours most CTAs.

---

## 7. Feature triage cheat sheet

| Keep (product) | Thin / debt | Cut or don’t build without a backend |
|---|---|---|
| Gated catalog, intern Today/overview/step, BR finalize, approvals+Outlook, client inbox+flowchart, files/S3, KB staff, multi-client team, audit scoped, theme toggle | Analytics demo data, intern analytics/audit nav, settings=password only, compliance digest, Approvals empty state, OnboardingWizard, dual toasts, KPI/status duplication | Client Messages/chat, showing BR drafts, email on intern autosave, dropping client sequential gate, reintroducing Supabase |

---

## 8. Architecture (so you don’t propose impossible features)

- Stack: Next.js 16, React 19, Drizzle/Postgres, Auth.js, S3/MinIO, Inngest, Resend + Graph, Tailwind 3.4, TanStack Query, Framer Motion, Vitest.
- **Only repositories import `db`.** Views call APIs. New objects = table + AuthContext repo + route + hook.
- Checklist lives in `engagements.checklist_state` jsonb — not one row per step.
- Lifted domain (`src/data/checklist.ts`, validators, docx, compliance math) — don’t invent new MCA steps in a visual brainstorm.
- `AUTH_URL` unset locally. No secrets in the client bundle.

**Safe:** CSS variables, fonts, logo, marketing, density, consolidating primitives, nav labels, cutting dead routes after confirm.  
**Unsafe without explicit yes:** new checklist steps, ungating clients, `db` in views, silent manager accept (skipping email), client chat.

---

## 9. How to answer the owner

They will describe colours, mood, references, and feature ideas. You must:

1. Give a **recommended visual system** (palette light+dark, type, radius, phase/status rules, role atmospheres).
2. Say **which roles** each change hits (intern vs client vs admin/manager share code).
3. **Triage features** keep / restyle / cut / postpone.
4. Prefer token-level restyle over 70 unique page inventions unless they want a new component language.
5. End with: **Decisions · Open questions · Implementation notes (files) · Risks**.

Key files: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `src/components/noir/*`, `src/components/shell/*`, `src/lib/phase-colors.ts`, `src/lib/motion.ts`, `src/components/brand/SbcLogo.tsx`, `src/components/marketing/*`, `src/views/auth/Login.tsx`.

---

## 10. Owner will fill (if missing, ask)

Mood adjectives · primary colour · light vs dark default · one brand vs per-role atmospheres · reference products · must keep / must change · scope (tokens only vs IA vs new features).
