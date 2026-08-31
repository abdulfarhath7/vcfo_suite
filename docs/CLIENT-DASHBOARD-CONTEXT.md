# Client Dashboard — build context for Claude Code

**Mission:** Rebuild the VCFO Suite **client** surface from scratch into a visual "mission control" dashboard that makes a foreign parent feel their India entity is in safe, expensive hands — and that impresses the firm's team in demos. More visuals (progress ring, phase bars, timeline, compliance runway), more polish, real data only. You may delete and rewrite the existing client dashboard freely.

**Work style the owner asked for:** build continuously and methodically, take your own time, verify as you go, and make every module look and feel great before moving on. Do not rush to "done"; rush to *right*. Keep the backlog moving across sessions using a progress log (see §3).

This file is the source of truth. If anything here conflicts with an old assumption in the repo, this file wins for the client surface.

---

## 1. Read before you build (do not skip)

Inspect these in the actual repo first so you match existing patterns and quality:

1. **The lead dashboard** the owner just built and is happy with — find it under `app/app/intern/*` (Today, engagement overview, step workspace). **Match or exceed its polish, spacing, motion, and component style.** This is the concrete quality anchor for "great."
2. **Client shell + current screens:** `app/app/client/*` (inbox, incorporation, compliances, documents, team, activity). Learn the current routing, layout width, and how these screens read engagement state — then replace, don't patch around.
3. **Design primitives:** `src/components/noir/*` (`Surface`, `AccentButton`, `GoldButton`→renders blue, `EmptyStateIllustrated`, `StatusDot`, `KpiNumber`), `src/components/shell/*`, `JourneyNode`, `src/lib/phase-colors.ts`, `src/lib/motion.ts`.
4. **Tokens:** `app/globals.css` (OKLCH `:root` + `.dark`) and `tailwind.config.ts`. **Everything you build consumes these tokens — no hardcoded hex.**
5. **Data + gating:** `src/data/checklist.ts` (the ~34-step catalog — **read-only, do not edit**), `src/lib/checklist-step-gate.ts` (gate logic — **reuse, do not reimplement**), and how `engagements.checklist_state` (jsonb) is shaped.
6. **The repository seam:** `src/db/repositories/*` (only these may import `db`) and how existing API routes pass `AuthContext`.

If a file path here differs from the repo, trust the repo and note the correction in the progress log.

---

## 2. Defaults / assumptions (owner can override any of these)

| Decision | Default chosen | Override by telling the owner / editing this file |
|---|---|---|
| **Landing** | New **Overview** dashboard becomes the client landing. It leads with the "what do you need from me" next-action (so it is still inbox-first *in spirit*). **Incorporation** stays the interactive gated flowchart. Keep a lighter **Inbox** task list reachable — do **not** build a second flowchart/progress surface. | Owner may instead want Option 2: enrich the existing Inbox in place, no nav change. |
| **Pre/post-COI adaptivity** | Yes. Detect whether a CIN exists. Pre-COI emphasizes getting incorporated (progress + next action). Post-COI raises the compliance runway + entity ID card. Same page, two moods. | Owner may want one static layout. |
| **Brand** | Build on the **current cool-blue token system** using existing CSS variables and noir primitives — so a future rebrand reskins this for free via a token swap. | If a rebrand lands first, rebuild tokens first, then this. |

Do not block on these — build with the defaults and leave `// TODO(owner):` markers where a flip would matter.

---

## 3. How to work (continuous, methodical protocol)

1. **Create and maintain `CLIENT-DASHBOARD-PROGRESS.md`** at repo root. Mirror the backlog in §10 as checkboxes, update it as you complete each task, and note decisions/corrections. This makes the build resumable across sessions — if restarted, read it first and continue where you left off.
2. **Build the data layer first** (§7). Every UI module reads real data from day one — never stub with placeholder numbers.
3. **One module at a time, fully.** Read the relevant real files → build → self-review against the quality bar (§9) → iterate until it meets the bar → run verification (§11) → check it off → continue to the next. Do not batch half-finished modules.
4. **Do not stop for permission** except when a change would touch a **do-not-break guardrail (§5)** or needs a product decision not covered here. In that case: pick the safe default, add a `// TODO(owner):` comment, log it, and keep building.
5. **Prefer many small, verified commits** over one large one. Keep `main`/working branch green (typecheck + tests pass) at every commit.
6. **When the backlog is complete,** do a full-surface polish pass (§10, P3) rather than declaring victory early.

---

## 4. What this surface is for

Answer three questions in five seconds, in this priority order:
1. **What do you need from me right now?** (the single next action)
2. **Where are we overall?** (progress at a glance)
3. **What has been done / what's coming?** (momentum + compliance runway)

Emotional target: precision, trust, momentum, reassurance. Not a BI tool. Not playful (these are MCA filings). The client should feel *"my India setup is on track and these people know what they're doing."*

---

## 5. Do-not-break guardrails (hard constraints)

- **Sequential gate stays.** Charts, timelines, and progress views are **read-only reflections** of state. They must never allow jumping a locked step. Reuse `checklist-step-gate.ts` to decide what is open/locked/next. Locked copy stays "This opens after {title} is complete." — never "access denied."
- **No board-resolution drafts to the client.** The timeline/vault surface the BR only once `status=finalized`.
- **No firm analytics, no other engagements, no portfolio metrics.** Everything is scoped to *this client's* engagement(s). If the team wants firm analytics, that is the separate admin/manager Analytics screen — out of scope here.
- **Real data only.** Every number and chart reads from `checklist_state` / compliance instances / documents / scoped audit. **Never** wire a chart to a hardcoded demo series. If data is absent, render an honest empty state (`EmptyStateIllustrated`), never placeholder figures.
- **No chat.** Contact = opens an email draft (as `/contact` already does). Messages is a dead redirect; do not design a chat without a real backend.
- **Status colour lives in chips/icons/chart fills only — never full-page fill.** Phase washes stay analogous and quieter than the primary blue.
- **Repository seam is sacred.** Views never import `db`. Data comes via API route → repository, each taking `AuthContext` and filtering by role.
- **Do not edit** `src/data/checklist.ts`, per-step validators, docx generators, or compliance math. Do not change email/Outlook fan-out or the BR finalize semantics.
- **Client is a different product** from the intern shell: lower density, more reassurance, content width ~1200 (not the intern width). Never show the code role word "intern" anywhere.

---

## 6. Architecture rules

- New aggregated read = **new repository function + API route + TanStack Query hook**, all taking `AuthContext`. No `db` in views.
- The overview is **read-only**; every actionable element **deep-links into the existing screen** that owns that action (a step, a document upload, the flowchart). Do not duplicate workflows.
- Reuse existing gate/status logic; do not fork it.
- Loading = `skeleton-brand` skeletons, **not** the full-screen "Opening VCFO Suite…" boot screen.
- Motion = existing Framer `m` + `LazyMotion domMax`, `layoutId` pills, `page-fade-up`. Reuse `PhaseCelebration` for milestones — no modal spam. Never put a CSS `transform` on a `layoutId` host.

---

## 7. Data layer to build first

Create one scoped read that powers the whole surface.

- **Repository:** `src/db/repositories/client-overview.ts` (or fit an existing client repo), function `getClientOverview(ctx: AuthContext, engagementId)`.
- **API route:** `app/api/client/overview/route.ts` (scoped to the caller's engagement).
- **Hook:** `useClientOverview()` (TanStack Query).

**Shape to aim for** (verify each field against the real schema; drop what isn't available rather than inventing it):

```ts
type ClientOverview = {
  engagement: {
    companyName: string;
    legalForm: 'company' | 'llp' | 'partnership' | 'proprietorship';
    domesticOrForeign: 'domestic' | 'foreign';
    startDate: string;
    incorporationDate?: string;   // presence ~ post-COI
    cin?: string; pan?: string; tan?: string;   // entity ID card, post-COI
  };
  progress: {
    overallPct: number;
    byStatus: { completed: number; inProgress: number; awaitingClient: number; locked: number; overdue: number };
    byPhase: { phase: 'part-a' | 'part-b' | 'post-inc' | 'registration'; label: string; pct: number }[];
  };
  nextAction?: {                  // the current unlocked client-owned item, via gate logic
    stepId: string; title: string; href: string; dueLabel?: string;
  };
  ballInCourt: { waitingOnClient: number; waitingOnFirm: number };
  documents: {
    deliverables: { name: string; kind: string; href: string; issuedAt?: string }[]; // COI, PAN, TAN, GST, MOA/AOA
    counts: { requested: number; submitted: number; delivered: number };
  };
  compliance?: {                  // post-COI, from Inngest-generated instances
    upcoming: { title: string; type: 'GST' | 'TDS' | 'PF' | 'ROC' | 'FLA' | string; dueDate: string; status: string }[];
  };
  activity: { at: string; label: string }[];   // scoped audit, recent first
  team: { name: string; role: 'Project Manager' | 'Project Lead' }[];   // firm-side people on this file
};
```

Required test: a **scoping test** proving a client cannot read another engagement's overview (cross-tenant). Keep everything else testable; a broader test pass can follow.

---

## 8. Modules + recommended composition

Build these as small components under the client shell. Reuse noir primitives; do not invent parallel KPI/status components.

**Recommended vertical order at ≤1200px:**

1. **Status hero** — serif company name + `legalForm` + one-line state ("Incorporation 68% complete" pre-COI / "COI issued ✓ — now in Registration" post-COI), beside the **overall progress ring** (donut).
2. **Next-action card** — "We need X from you," CTA deep-links into the step via `nextAction.href`. If nothing is waiting on the client: a calm "You're all set — we're working on it" state.
3. **≤4 KPI cards** — % complete · items awaiting you · documents ready · next deadline.
4. **Phase progress bars** — four horizontal bars (SPICe+ Part A · Part B · Post-incorporation · Registration), each `pct` from `byPhase`. Use quiet phase washes from `phase-colors.ts`.
5. **Ball-in-court split** — a small bar: waiting on you vs waiting on us. Reassurance + nudge.
6. **Journey timeline** — vertical milestone track (Name approved → Incorporated → GST → …). At-a-glance only; the interactive flowchart stays on Incorporation. Reuse `JourneyNode` styling (blue active pulse, teal check, coral clock, slate lock).
7. **Compliance runway** (post-COI) — next ~90 days of filings as a bar chart / timeline grouped by type (GST/TDS/PF/ROC/FLA). Empty pre-COI.
8. **Document deliverables** — download tiles for COI, PAN, TAN, GST cert, MOA/AOA. Doc status counts as a small donut.
9. **Entity ID card** (post-COI) — CIN/PAN/TAN/incorporation date/registered office styled like a passport/ID (mono for the identifiers). A screenshot-able trust artifact.
10. **Your team** — PM + Project Lead names/roles. "Real experts on your file."
11. **Activity feed** — recent scoped audit ("Board resolution finalized," "GST certificate delivered").
12. **Milestone celebration** — reuse `PhaseCelebration` on COI issued / GST registered.
13. **Contact** — opens an email draft. Not chat.

Pre-COI emphasizes 1–8; post-COI raises 7 and 9 toward the top.

**Charts (recharts is in the stack):** donut for overall + doc status (≤6 slices); horizontal stacked/plain bars for phases and compliance-by-type. No line charts unless there's a real time series. Hover reveals detail; default stays clean (progressive disclosure).

---

## 9. Design quality bar — definition of "looks and feels great"

A module is done only when all of these hold:

- **Five-second rule:** the hero answers "where am I / what's next" instantly.
- **≤4 KPI cards** in the top row; generous whitespace between zones.
- **Every actionable element** makes the next step obvious and deep-links correctly.
- **Charts are honest:** real data, sensible empty states, ≤6 slices on any donut.
- **Colour = communication, not decoration:** status only in chips/icons/chart fills; phase washes analogous and quieter than primary; near-white text on primary; contrast ≥ AA in light and dark.
- **Type:** serif (Space Grotesk) company H1; Manrope UI; IBM Plex Mono for CIN/PAN/TAN/dates/ids. Radius `0.875rem`; body ~15px.
- **Motion:** `page-fade-up` on load, `layoutId` where applicable, celebration once (no spam). Nothing janky.
- **Loading:** `skeleton-brand`, never the boot screen. Data streams in progressively; no blank blocking screen.
- **Dark + light both first-class,** cool-blue/slate family (never a brown/beige invert).
- **Responsive:** graceful stack on mobile (sheet nav), capped ~1200 on desktop.
- **Tokens only:** zero hardcoded hex; a future rebrand should reskin this by editing `globals.css` alone.
- **Matches or beats the lead dashboard's** spacing, density, and finish.

---

## 10. Build backlog (sequence; mirror into the progress log)

**P0 — data + demo-critical surface**
- [ ] Study lead dashboard, client shell, primitives, gate logic (§1).
- [ ] Build `getClientOverview` repository + API route + `useClientOverview` hook + scoping test (§7).
- [ ] Status hero + overall progress ring.
- [ ] Next-action card (with "all set" empty state).
- [ ] KPI row (≤4).
- [ ] Phase progress bars.
- [ ] Document deliverables tiles.
- [ ] Wire the Overview as the client landing (per §2 default); keep Incorporation flowchart intact; keep a lighter Inbox reachable.

**P1 — depth + reassurance**
- [ ] Journey timeline (read-only, reuses JourneyNode styling).
- [ ] Ball-in-court split.
- [ ] Activity feed (scoped audit).
- [ ] Your team.
- [ ] Milestone celebration (reuse `PhaseCelebration`).
- [ ] Contact (email draft).

**P2 — ongoing-value layer**
- [ ] Compliance runway (post-COI, from Inngest instances).
- [ ] Entity ID card (post-COI).
- [ ] Pre/post-COI adaptive ordering.
- [ ] Doc status donut.

**P3 — polish pass (do not skip)**
- [ ] Dark/light audit across every module.
- [ ] Mobile/responsive audit.
- [ ] Motion + loading-state audit.
- [ ] Hunt and remove any hardcoded hex; confirm token-only.
- [ ] Consolidate any duplicate KPI/status/empty-state components you touched.
- [ ] Final pass against §9 for every module.

---

## 11. Verification (after each module)

- `npm run typecheck` — must pass.
- `npm run test` — must pass (token/UI changes should rarely touch domain tests; if a domain test breaks, you changed something you shouldn't have — revert).
- Manually log in as `client@vcfo.local` / `client123` and confirm the module renders with real seed data in both light and dark.
- Confirm no `db` import leaked into a view; confirm no locked step became reachable.

---

## 12. What NOT to do

- Do not edit the checklist catalog, validators, docx generators, compliance math, or email/Outlook fan-out.
- Do not drop or weaken the client sequential gate.
- Do not show BR drafts, firm analytics, other engagements, or any placeholder/demo numbers.
- Do not add chat, a second progress/flowchart surface, or a fifth "portfolio" nav item.
- Do not hardcode colours or bypass tokens.
- Do not import `db` from a view.
- Do not declare done before the P3 polish pass.
