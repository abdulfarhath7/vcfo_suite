# Client Dashboard — build progress log

Source of truth for the build: `docs/CLIENT-DASHBOARD-CONTEXT.md`.
This file mirrors that backlog (§10) as checkboxes and records decisions and
corrections so the build is resumable across sessions. Read this first on
restart, then continue at the first unchecked item.

---

## Repo corrections to the context doc (§1 said "trust the repo")

| Context doc says | Repo actually has |
|---|---|
| lead dashboard under `app/app/intern/*` | Route shells only. Real UI lives in `src/views/intern/Today.tsx` + `src/components/intern/Lead*.tsx`. That is the quality anchor. |
| client screens under `app/app/client/*` | Route shells only; views in `src/views/client/*`. Client landing was `redirect('/app/client/inbox')`. |
| `JourneyNode` (unqualified) | `src/components/incorporation/JourneyNode.tsx` |
| `src/lib/motion.ts`, `src/lib/phase-colors.ts` | Both correct. |
| `checklist_state` shape | `Record<itemId, ChecklistItemStateSlice>` — normalized by `normalizeEngagementChecklistState`. |
| four phases | `getIncorporationPhases()` returns exactly 4: `pre-inc-phase-1` (Part A), `pre-inc-phase-2` (Part B), `post-inc-phase-3`, `registration-phase-4`. |
| CIN/PAN/TAN | Not columns. They live in `checklist_state['pre-12'].responses` (`cin`, `pan`, `tan`, `pfCode`, `esiCode`). `engagements.incorporation_date` is a real column. |
| compliance `type` union | Real data keys off `compliance_obligations.authority` (`GST`/`IT`/`EPFO`/`ESIC`/`PT`/`MCA`/`RBI`/`DGFT`), not the doc's `'GST' \| 'TDS' \| ...`. Kept as `string` + a display grouping. |

Decisions taken (defaults from §2, no owner block):

- Overview is the client landing (`/app/client` and `/app/client/overview`);
  Inbox stays reachable in nav; Incorporation flowchart untouched.
- Pre/post-COI adaptivity keyed on `cin` presence (falls back to
  `incorporation_date`).
- Built on existing cool-blue tokens + noir primitives — no new colour system.

---

## P0 — data + demo-critical surface

- [x] Study lead dashboard, client shell, primitives, gate logic (§1).
- [x] `getClientOverview` repository + API route + `useClientOverview` hook + scoping test (§7).
- [x] Status hero + overall progress ring.
- [x] Next-action card (with "all set" empty state).
- [x] KPI row (≤4).
- [x] Phase progress bars.
- [x] Document deliverables tiles.
- [x] Wire the Overview as the client landing; Incorporation flowchart intact; Inbox reachable.

## P1 — depth + reassurance

- [x] Journey timeline (read-only, reuses JourneyNode styling).
- [x] Ball-in-court split.
- [x] Activity feed (scoped audit).
- [x] Your team.
- [x] Milestone celebration (reuse `PhaseCelebration`).
- [x] Contact (email draft).

## P2 — ongoing-value layer

- [x] Compliance runway (post-COI, from Inngest instances).
- [x] Entity ID card (post-COI).
- [x] Pre/post-COI adaptive ordering.
- [x] Doc status donut.

## P3 — polish pass

- [x] Dark/light audit across every module.
- [x] Mobile/responsive audit.
- [x] Motion + loading-state audit.
- [x] Hunt and remove any hardcoded hex; confirm token-only.
- [x] Consolidate any duplicate KPI/status/empty-state components touched.
- [x] Final pass against §9 for every module.

---

## Build notes

**Data layer split.** The pure shape builder lives in `src/lib/client-overview.ts`
(no `db`, no `server-only`) so it is unit-testable and the view can import the
types. `src/db/repositories/client-overview.ts` only gathers rows and calls it.
That keeps the seam intact: the view imports types from `@/lib/client-overview`
and data from the API route.

**Gate reuse.** `nextAction`, `ballInCourt`, the timeline node kinds, and the
locked counts all come from `gateActiveCatalog(state, 'client')` in
`src/lib/checklist-step-gate.ts`. No forked sequencing logic anywhere in the new
surface — the overview cannot open a locked step because it only renders
`kind` and deep-links to `/app/client/incorporation?step=<id>`, which the wizard
re-gates server-side.

**Deliverables.** Curated allowlist of certificate fields only (COI, PAN card,
TAN card, MOA/AOA subscription sheets, GST certificate, IEC certificate) —
`CLIENT_DELIVERABLE_FIELDS` in `src/lib/client-overview.ts`. Board-resolution
drafts are deliberately absent from that list, so §5's "no BR drafts to the
client" holds by construction.

**Empty states.** Every module renders `EmptyStateIllustrated` or a calm inline
empty line when its data is absent. No module fabricates a number.

**Verification run (2026-08-31).**

- `npm run typecheck` — clean.
- `npm run test` — 89 files / 777 tests pass, including 52 new ones:
  `src/lib/client-overview.test.ts` (derivations), `src/db/repositories/client-overview.test.ts`
  (cross-tenant scoping), `src/components/client/overview/client-overview-modules.test.tsx`
  (every module, pre- and post-COI fixtures), `src/views/client/Overview.test.tsx`
  (loading / error / empty states and the adaptive ordering).
- `npx eslint` on every new file — 0 warnings.
- Read-only probe of `getClientOverview` against the live local Postgres as the
  seeded client: returns Emburse, 0/46 milestones, next action `pre-1`, real
  team (Pranay Kumar / Sasi Kumar), real audit line. A cross-tenant request for
  a foreign engagement id returned `null`.
- `GET /api/client/overview` unauthenticated returns 401.

**Not yet done: the manual browser pass (§11).** This database holds real
people, not the `client@vcfo.local` / `client123` demo seed, so there was no
client login available to sign in with — and creating or resetting an account
would have written to real data. The light/dark and mobile checks were done by
code audit (token-only colours verified by grep; every module has explicit
`sm:`/`lg:` stacking) plus the render tests. Sign in as a client and open
`/app/client/overview` to confirm the pixels.

**Known gaps worth an owner decision (`// TODO(owner):` where relevant).**

- Post-COI modules are unverified against real data — the one client on this
  database is at 0% and pre-incorporation, so the entity ID card, deliverable
  tiles, and compliance runway have only been exercised against test fixtures.
- Deliverables are read straight from `checklist_state` responses, matching what
  the existing Documents view already shows the client. There is no extra
  "delivered" gate on them beyond the curated field allowlist.

---

## Owner direction (2026-08-31): match the lead dashboard

The owner asked for the client surface to look and feel like the lead
dashboard, which overrides §5's "lower density, different product" line for
the visual layer. The surface was restyled onto the lead's own primitives:

| Element | Now shares with the lead dashboard |
|---|---|
| Hero | `.lead-hero` — the blue→violet→pink gradient, white type, white ring with a caption under it, white hairline, inline fact strip (`LeadHero`'s exact structure) |
| KPI row | `.lead-metric` — solid 30px icon chip, coloured cap rule, big serif number (`LeadMetricCard`) |
| Every other card | `.surface` + `ClientCard`: solid 28px icon chip, `text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink` heading, `px-4 pt-3 / pb-3.5 pt-2.5` body — identical to `LeadSideRail` / `LeadPhaseProgress` |
| Layout | `xl:grid-cols-[minmax(0,1fr)_320px]` main column + right rail, `gap-3`, same as intern Today |
| Type scale | 12.5px body, 11px meta, serif numbers, `text-ink` for emphasis |

`ClientCard` (`src/components/client/overview/ClientCard.tsx`) is the single
section shell — that is why the header is not repeated in twelve files.

Dead CSS removed as part of this: `.client-card`, `.client-kpi`, `.client-hero`,
`.client-hero-rule`, and the `--radius-client` token. What is left in
`globals.css` is only what has no lead-side equivalent: `.client-bar-track` /
`.client-bar-fill`, `.client-idcard`, `.client-rail-line`, `.client-doc-tile`.

## Defects found and fixed during the browser pass

1. **`ProgressRing` never rendered anywhere in the app.** The primitive wrapped
   its SVG in a `<progress>` element. `<progress>` is a *replaced* element, so
   its children are fallback content for browsers without support and are laid
   out at 0×0 — confirmed in Chromium (`getBoundingClientRect()` returned
   `0×0`), and `appearance: none` does not change it. Swapped the wrapper for a
   `div role="progressbar"` with `aria-valuenow/min/max`. This also fixes the
   ring on intern Clients, admin EngagementDetail, ProjectDetailSections, and
   client Incorporation, where it had silently been invisible.
2. **Journey station labels were past tense** ("Company details received") while
   the state chip said "In progress". Labels are now state-neutral nouns; the
   chip carries the tense.
3. **Doc-status donut was a solid coral ring** for every brand-new client, whose
   only row is one pending request. `--warning` is a chip colour in this
   system (see the palette note at the top of `globals.css`), not a chart fill
   at that size. "Still needed" now uses the quiet sky wash.
4. **Ball-in-court copy** read "We are handling 0 steps while one waits on you."
   Added the `waitingOnFirm === 0` branch.
5. **Compliance runway rows collapsed to one letter** at 320px rail width. They
   are two-line dense rows now, like `InternWorkDenseRow`.
6. **Entity ID card broke the CIN mid-token** on a 390px screen. Single column
   below 420px.
7. Hero said "…, 73% complete" beside a ring reading 46%. It reports counts now.

## Browser pass (§11) — done

Signed in as the real client (`bharath@sbcllp.in`) against local Postgres and
drove `/app/client/overview` in Chromium:

- **Desktop light, desktop dark, mobile (390px) light** — real data (Emburse,
  0/46, next action `pre-1`, real team, real audit line). No console errors.
- **Post-COI mood** — verified by intercepting the API response in the browser
  and substituting an incorporated engagement. Nothing was written to the
  database; the one real client on it is still pre-incorporation, so this is
  the only way to see the entity ID card, deliverable tiles, and a populated
  runway against real rendering. Captured desktop light and mobile dark.
- The `PhaseCelebration` ribbon fires once on a newly completed phase.

---

## Owner direction (2026-08-31, follow-up): metrics inside the greeting card

> "the metric cards should be inside the greeting card ... changes which lead to
> consistency in ui of lead and client dashboard"

- The four key numbers moved **into the hero** as the lead's stat strip —
  `0% Complete | 1 Awaiting you | 0 Documents | — Next deadline`, each a link,
  using `LeadHero`'s exact markup (serif value + small label, `border-l
  border-white/20` dividers, `hot` emphasis when something is waiting on the
  client). `ClientKpiRow.tsx` was deleted; there is no separate metric row.
- Hero top line is now the live `ClientLocaleNowLabel` clock, same leaf
  component the lead hero uses, followed by the legal form and the foreign-parent
  chip.
- Hero ring is 52px with a caption under it, matching `LeadHero` exactly.
- Doc-status donut dropped to 112px with the legend beside it, matching
  `LeadSideRail`'s compliance donut rather than a large standalone chart.
- The page footer ("Something not clear? Refresh…") was removed — intern Today
  has no page footer, and the surface should end the same way.

Net effect: hero → next action → (entity card) → phase bars + ball-in-court →
documents → journey in the main column, with runway / team / activity in a
320px right rail. Same silhouette as `/app/intern/today`.

Re-verified after the change: `typecheck` clean, 89 files / 777 tests pass,
eslint clean on the surface, and the browser pass re-run in desktop light,
desktop dark, mobile light, plus the intercepted post-COI mood in desktop light
and mobile dark. No console errors.

---

## Owner direction (2026-08-31, follow-up 2): remove the padlocks

Visual only — the sequential gate is **unchanged**, in the UI and on the server.
Upcoming steps still cannot be opened, and `gate.message` still says
"This opens after {title} is complete." What went away is the padlock glyph and
the word "Locked".

| File | Before | After |
|---|---|---|
| `components/incorporation/JourneyNode.tsx` | locked node drew a padlock; `showLock` prop toggled it | always draws the step number (dim dot when there is no number); `showLock` prop deleted |
| `components/incorporation/ChecklistJourneyRail.tsx` | padlock in the `ChecklistLockedHint` popover; passed `showLock` | clock glyph in the popover; prop call removed |
| `components/incorporation/ChecklistClientWizard.tsx` | padlock on the "This step is not open yet" panel | clock glyph |
| `components/incorporation/ChecklistClientFlow.tsx` | rail status read `Locked` | reads `Upcoming` |
| `views/admin/EngagementDetail.tsx` | locked rows swapped the status pill for a padlock, plus a trailing padlock | real status pill on every row; trailing padlock replaced by a width spacer so rows stay aligned |
| `views/admin/ProjectDetailSections.tsx` | locked rows drew a padlock instead of the status dot and hid the status label; trailing padlock | status dot and label on every row; trailing padlock replaced by a spacer |

Also removed three dead `Lock` imports that never rendered
(`useMilestoneResponseFormState`, `useBoardResolutionEditorState`,
`BoardResolutionEditorDocPanel`).

**Deliberately kept** — these are not step lock-outs:

- Password fields on `CreateProjectFormClientSection` / `CreateInternForm`.
- `FieldUnlockIconButton` on the milestone form — a staff control that locks or
  unlocks one field for the client. Removing its icon would remove a feature
  affordance, not a decoration.
- `BoardResolutionEditorView`'s "Finalized — client visible" chip still carries a
  padlock. That is the board-resolution editor, not a dashboard, and there the
  glyph means "immutable now". Say the word and I will swap it for a check.

Verified: `typecheck` clean, 91 files / 805 tests pass, and the browser pass
re-run — client incorporation rail (steps 2–5 now read `2 · Upcoming` rather
than a padlock), client overview journey, and the admin project detail
(status dot + `NOT STARTED` on every row). No console errors.
