# Client Dashboard — cleanup & polish context for Claude Code

**Mission:** Refine the existing client home. It is already good — hero, one clear next action, progress, documents, team, activity, journey are all present. This is an **editing** pass, not a rebuild: **subtract redundancy, make it adaptive to pre/post-COI, elevate the one next action, and sell the journey ahead.** Presentation + composition only — no workflow, data, gate, or IA changes.

**North star:** Say each thing once. Empty states are quieter than content, never louder. Sentence case, one plain voice. Pre-COI, sell the destination — don't show the client four zeros. The target is roughly the same information with ~30% less on screen, reading as *deliberate* rather than *assembled*.

Shares the subtraction rules in `UI-CLEANUP-CONTEXT.md`; this file adds the client-home-specific composition changes.

---

## 0. Locked decisions (owner-approved; override only if told)

| Decision | Locked value |
|---|---|
| Progress cards | **Merge** "Where we are" + "Your journey" into ONE progressive card (phase bars → expandable step timeline). Two cards showing the same data becomes one. |
| Adaptive layout | **Lean pre-COI, richer post-COI.** Detect COI via CIN / incorporation date. The dashboard visibly *becomes* richer once incorporated. |
| "Whose turn it is" card | **Cut pre-COI** (redundant with the hero + next-action). Reintroduce **post-COI** when work genuinely ping-pongs. |
| Brand | Build on current tokens + canonical components; no rebrand, no new variants. |

---

## 1. Read before you build

- The existing client dashboard and its per-engagement data read (`getClientOverview` or equivalent) — reuse/extend it; do not invent a new source of truth.
- `DESIGN-SYSTEM-INVENTORY.md` / the Project Lead dashboard — for the canonical section header, empty state, status pill, KPI, table, and the shared chart layer.
- `UI-CLEANUP-CONTEXT.md` — the shared subtraction north star.

---

## 2. Zone-by-zone edits

**Hero**
- Remove the filler subcopy ("We are getting Emburse started").
- Remove the duplicated "0% Complete" text — the ring already owns the percentage.
- Keep: entity name + parent + type + ONE honest status line ("Incorporation not started — the first step is yours" pre-COI). Keep the compact stat strip but drop the redundant % from it (carry Awaiting-you / Documents / Next-deadline only).

**Next action (the focal point)**
- This is the best element on the page — give it prominence and room.
- Drop the tracked-caps eyebrow ("WE NEED THIS FROM YOU") → sentence case or just the step title. Keep the "Open this step" CTA and its existing deep-link.

**Progress — merge into one card**
- One card. Top: phase bars (SPICe+ Part A · Part B · Post-incorporation · Registration), **shaped even when empty** so it reads as "a journey ahead," not four zeros. Expand / "See every step" reveals the full step timeline (today's "Your journey").
- Do NOT keep two separate cards for the same data.
- Pre-COI framing is aspirational: "Your path to an incorporated India entity."

**"Whose turn it is"**
- **Cut it pre-COI.** It restates the hero ("1 Awaiting you") and the next-action card. Reintroduce post-COI only, where waiting-on-you-vs-us is genuinely informative.

**Documents**
- Pre-COI / zero documents: ONE calm line via the canonical empty state — no illustration + heading + paragraph + donut all at once (they currently fight each other).
- The donut + deliverables list appears only when there is ≥1 real document. Post-COI it shows COI / PAN / TAN / GST etc.

**Compliance runway**
- Pre-COI: ONE calm line, no card chrome, no icon tile, no eyebrow ("Your compliance calendar begins once your Certificate of Incorporation is issued.").
- Post-COI: real upcoming filings, linking to the Filings feature.

**Team**
- Keep — it's a trust signal. Sentence-case the title. Do NOT add a response-time/SLA promise that isn't wired.

**Activity (fix the worst first-impression offender)**
- Currently shows "Client asked for a change on Client Details" three times in a row — reads like a bug or noise.
- De-duplicate identical/consecutive events (show the latest with a count, or group), latest-first, quiet styling, sentence-case title.

**Global**
- Remove ALL tracked ALL-CAPS eyebrow labels across the dashboard → sentence case (or nothing where the content is obvious).
- Drop blanket icon-tile decoration on every card header; keep icons only where they aid scanning.

---

## 3. Adaptive behavior (pre-COI vs post-COI)

| Element | Pre-COI | Post-COI |
|---|---|---|
| Hero status | "Incorporation not started / in progress" + ring | "Certificate of Incorporation issued ✓" + entity IDs (CIN/PAN/TAN) |
| Progress card | aspirational framing, empty-but-shaped bars | live progress, registration detail |
| Whose turn it is | hidden | shown (real ping-pong) |
| Documents | one calm line | donut + deliverables list |
| Compliance runway | one calm line | upcoming filings + link to Filings |

Same page, two moods, driven by whether a CIN exists. No duplicate layouts — one component tree that adapts.

---

## 4. Consistency contract

- Reuse the canonical section header (sentence case), empty state, status pill, KPI, table, and the shared chart layer. **No new variants.** (Recall the earlier drift: metric cards placed outside a panel unlike the lead dashboard — don't repeat that class of mistake.)
- Tokens only; zero hardcoded hex or one-off spacing; both light and dark first-class.
- Status colour in chips/icons/chart fills only, never page fill. Client width stays ~1200.

---

## 5. Do-not-break guardrails

- **Presentation + composition only** — no changes to the sequential gate, the approval/workflow, email/WhatsApp fan-out, or the repository seam.
- The next-action card's **deep-link and target are unchanged**.
- **No firm analytics / other engagements** — everything stays scoped to this client.
- **No board-resolution drafts** surfaced to the client.
- **Real data only** — no demo series; absent data → the canonical calm empty state, never fabricated numbers.
- **Don't remove features** — buttons, links, the journey, the team card all stay. Remove redundancy and decoration, not function.
- Data reads via API → repository with `AuthContext`; no `db` in views.

---

## 6. How to work

1. Maintain `CLIENT-DASHBOARD-POLISH-PROGRESS.md`; log decisions; resumable.
2. Edit one zone at a time, fully; verify (§8); run a consistency audit against the lead dashboard; commit; continue.
3. Don't stop for permission on the locked edits above; flag `// TODO(owner):` only on genuine judgment calls.
4. Small, verified commits; keep the branch green.

---

## 7. Build backlog

**P0 — subtraction (biggest visible win)**
- [ ] Remove tracked ALL-CAPS eyebrows → sentence case; trim blanket icon tiles.
- [ ] Hero: drop filler subcopy + duplicated %.
- [ ] Cut "Whose turn it is" (pre-COI).
- [ ] Fix the activity feed: de-duplicate, latest-first, quiet.
- [ ] Documents + Compliance runway: calm one-line empty states in the content slot.

**P1 — composition**
- [ ] Merge "Where we are" + "Your journey" into one progressive card (bars → expandable timeline), aspirational pre-COI framing.
- [ ] Elevate the next-action card as the focal point.

**P2 — adaptive**
- [ ] Pre/post-COI adaptation (§3): hero IDs, whose-turn reintroduced, documents donut, compliance filings — all gated on CIN presence.

**P3 — polish**
- [ ] Light/dark + responsive audit.
- [ ] Consistency audit vs. the lead dashboard; confirm no new variants.

---

## 8. Verify (per zone)

- `npm run typecheck && npm run test` pass.
- Login `client@vcfo.local / client123`: each fact appears once; empty states are a single calm line in the content slot; activity shows no duplicate spam; the next action is the clear focal point.
- Both light and dark render cleanly; nothing functional was removed.
- Simulate post-COI (a CIN present) and confirm the layout visibly enriches (IDs, whose-turn, documents, filings).
- Visual consistency check vs. the lead dashboard.

---

## 9. What NOT to do

- Don't rebuild — this is editing; keep the good bones.
- Don't change workflow, gate, data, routes, or the next-action target.
- Don't remove features — only redundancy and decoration.
- Don't invent new components or fix clutter by adding decoration.
- Don't show firm analytics, other engagements, or BR drafts.
- Don't ship demo/placeholder numbers.
- Don't declare done before the pre/post-COI adaptation and the consistency audit.
